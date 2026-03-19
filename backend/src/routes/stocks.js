const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function fetchYahooPrice(symbol) {
  const suffixes = ['.NS', '.BO', ''];
  for (const suffix of suffixes) {
    try {
      const q = await yf.quote(symbol.toUpperCase() + suffix, {}, { validateResult: false });
      if (q?.regularMarketPrice) {
        return {
          price: q.regularMarketPrice,
          name: q.longName || q.shortName || null,
          fetched_symbol: symbol.toUpperCase() + suffix,
        };
      }
    } catch {}
  }
  return null;
}

// GET all active stocks (all authenticated)
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM stocks WHERE is_active = true ORDER BY symbol`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all stocks including inactive (admin)
router.get('/all', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT s.*,
        (SELECT MIN(t.executed_at) FROM transactions t WHERE t.stock_id = s.id AND t.type = 'buy') AS first_investment_date,
        (SELECT MAX(t.executed_at) FROM transactions t WHERE t.stock_id = s.id AND t.type = 'sell') AS last_sell_date,
        u.id AS holder_id, u.name AS holder_name, u.email AS holder_email, u.user_type AS holder_user_type,
        (SELECT CASE WHEN COUNT(DISTINCT h.avg_buy_price) = 1 THEN MIN(h.avg_buy_price) ELSE NULL END
         FROM holdings h WHERE h.stock_id = s.id) AS common_buy_price
      FROM stocks s
      LEFT JOIN users u ON u.id = s.holder_user_id
      ORDER BY s.symbol`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET holders of a specific stock (who invested and how much)
router.get('/:id/holders', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        u.id, u.name, u.email, u.user_type, u.role,
        h.quantity, h.avg_buy_price,
        s.current_price, s.symbol,
        ROUND((h.quantity * s.current_price)::numeric, 2) AS current_value,
        ROUND((h.quantity * s.current_price - h.quantity * h.avg_buy_price)::numeric, 2) AS unrealized_pnl,
        ROUND(h.quantity * h.avg_buy_price::numeric, 2) AS invested_amount,
        CASE WHEN h.avg_buy_price > 0
          THEN ROUND(((s.current_price - h.avg_buy_price) / h.avg_buy_price * 100)::numeric, 2)
          ELSE 0 END AS pnl_percent,
        COALESCE((
          SELECT ROUND(SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE -t.total END)::numeric, 2)
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id
        ), 0) AS realized_pnl,
        COALESCE((
          SELECT ROUND(SUM(t.total)::numeric, 2)
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'buy'
        ), 0) AS total_buy_amount,
        COALESCE((
          SELECT ROUND(SUM(t.total)::numeric, 2)
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'sell'
        ), 0) AS total_sell_amount,
        COALESCE((
          SELECT SUM(t.quantity)
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'buy'
        ), h.quantity) AS total_bought_quantity,
        CASE WHEN h.quantity > 0 THEN 'active' ELSE 'exited' END AS status,
        (
          SELECT MIN(t.executed_at)
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'buy'
        ) AS first_buy_date
      FROM holdings h
      JOIN users u ON u.id = h.user_id
      JOIN stocks s ON s.id = h.stock_id
      WHERE h.stock_id = $1
      ORDER BY h.quantity DESC, current_value DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST fetch live price from Yahoo Finance and update DB
router.post('/:id/fetch-price', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const stockRes = await query('SELECT * FROM stocks WHERE id = $1', [req.params.id]);
    const stock = stockRes.rows[0];
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const result = await fetchYahooPrice(stock.symbol);
    if (!result) {
      return res.status(422).json({
        error: `Could not fetch price for "${stock.symbol}". Try .NS or .BO suffix, or enter price manually.`
      });
    }

    const { rows } = await query(`
      UPDATE stocks SET previous_close = current_price, current_price = $1, last_updated = NOW()
      WHERE id = $2 RETURNING *
    `, [result.price, req.params.id]);

    res.json({ stock: rows[0], fetched_symbol: result.fetched_symbol, price: result.price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch price: ' + err.message });
  }
});

// POST preview live price for a symbol (before the stock is created)
router.post('/preview-price', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const result = await fetchYahooPrice(symbol);
    if (!result) {
      return res.status(422).json({ error: `Could not find price for "${symbol}". Try adding .NS or .BO suffix, or enter price manually.` });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create stock
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { symbol, name, sector, current_price } = req.body;
    if (!symbol || !name) return res.status(400).json({ error: 'symbol and name required' });
    const { rows } = await query(
      `INSERT INTO stocks (symbol, name, sector, current_price, previous_close, last_updated)
       VALUES ($1, $2, $3, $4, $4, NOW()) RETURNING *`,
      [symbol.toUpperCase(), name, sector || null, current_price || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Stock symbol already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update stock price / details
router.put('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { name, sector, current_price, is_active, investment_settled, pnl_settled } = req.body;
    const { rows } = await query(
      `UPDATE stocks SET
        name = COALESCE($1::varchar, name),
        sector = COALESCE($2::varchar, sector),
        previous_close = CASE WHEN $3::numeric IS NOT NULL THEN current_price ELSE previous_close END,
        current_price = COALESCE($3::numeric, current_price),
        is_active = COALESCE($4::boolean, is_active),
        investment_settled = COALESCE($6::boolean, investment_settled),
        pnl_settled = COALESCE($7::boolean, pnl_settled),
        last_updated = NOW()
       WHERE id = $5 RETURNING *`,
      [name ?? null, sector ?? null, current_price ?? null, is_active ?? null, req.params.id,
       investment_settled ?? null, pnl_settled ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stock not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /stocks/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT set or clear stock holder
router.put('/:id/holder', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { holder_user_id } = req.body; // null to clear
    const { rows } = await query(
      `UPDATE stocks SET holder_user_id = $1, last_updated = NOW() WHERE id = $2
       RETURNING id, holder_user_id`,
      [holder_user_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stock not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE stock
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { rows } = await query('SELECT id FROM stocks WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Stock not found' });
    await query('DELETE FROM stocks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Stock deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
