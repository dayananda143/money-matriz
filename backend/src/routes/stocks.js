const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function fetchYahooPrice(symbol) {
  const suffixes = ['.NS', '.BO', ''];
  for (const suffix of suffixes) {
    try {
      const sym = symbol.toUpperCase() + suffix;
      const q = await yf.quote(sym, {}, { validateResult: false });
      if (q?.regularMarketPrice) {
        let sector = null;
        try {
          const summary = await yf.quoteSummary(sym, { modules: ['assetProfile'] }, { validateResult: false });
          sector = summary?.assetProfile?.sector || null;
        } catch {}
        return {
          price: q.regularMarketPrice,
          name: q.longName || q.shortName || null,
          sector,
          fetched_symbol: sym,
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
        h.quantity, h.avg_buy_price, COALESCE(h.brokerage, 0) AS brokerage,
        h.group_id, (SELECT sg.label FROM stock_groups sg WHERE sg.id = h.group_id) AS group_label,
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
        CASE WHEN (
          SELECT SUM(t.quantity) FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'sell'
        ) > 0
          THEN ROUND((
            COALESCE((SELECT SUM(t.total) FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'sell'), 0) /
            (SELECT SUM(t.quantity) FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'sell')
          )::numeric, 2)
          ELSE NULL
        END AS avg_sell_price,
        CASE WHEN h.quantity > 0 THEN 'active' ELSE 'exited' END AS status,
        (
          SELECT MIN(t.executed_at)
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'buy'
        ) AS first_buy_date,
        (
          SELECT MAX(t.executed_at)
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'sell'
        ) AS last_sell_date,
        COALESCE((
          SELECT SUM(COALESCE(t.brokerage, 0))
          FROM transactions t WHERE t.user_id = u.id AND t.stock_id = s.id AND t.type = 'sell'
        ), 0) AS total_sell_brokerage
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

// GET single stock by id (admin)
router.get('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT s.*,
        (SELECT MIN(t.executed_at) FROM transactions t WHERE t.stock_id = s.id AND t.type = 'buy') AS first_investment_date,
        (SELECT MAX(t.executed_at) FROM transactions t WHERE t.stock_id = s.id AND t.type = 'sell') AS last_sell_date,
        (SELECT CASE WHEN COUNT(DISTINCT h.avg_buy_price) = 1 THEN MIN(h.avg_buy_price) ELSE NULL END
         FROM holdings h WHERE h.stock_id = s.id) AS common_buy_price
      FROM stocks s WHERE s.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Stock not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
      UPDATE stocks SET previous_close = current_price, current_price = $1,
        sector = COALESCE($2, sector), last_updated = NOW()
      WHERE id = $3 RETURNING *
    `, [result.price, result.sector || null, req.params.id]);

    res.json({ stock: rows[0], fetched_symbol: result.fetched_symbol, price: result.price, sector: result.sector });
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
    const { name, sector, current_price, is_active, investment_settled, pnl_settled, brokerage } = req.body;
    const { rows } = await query(
      `UPDATE stocks SET
        name = COALESCE($1::varchar, name),
        sector = COALESCE($2::varchar, sector),
        previous_close = CASE WHEN $3::numeric IS NOT NULL THEN current_price ELSE previous_close END,
        current_price = COALESCE($3::numeric, current_price),
        is_active = COALESCE($4::boolean, is_active),
        investment_settled = COALESCE($6::boolean, investment_settled),
        pnl_settled = COALESCE($7::boolean, pnl_settled),
        brokerage = COALESCE($8::numeric, brokerage),
        last_updated = NOW()
       WHERE id = $5 RETURNING *`,
      [name ?? null, sector ?? null, current_price ?? null, is_active ?? null, req.params.id,
       investment_settled ?? null, pnl_settled ?? null, brokerage ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stock not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /stocks/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET transaction history for a specific holder in a stock
router.get('/:id/holders/:holderId/transactions', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.id, t.type, t.quantity, t.price, t.total, t.notes, t.executed_at, COALESCE(t.brokerage, 0) AS brokerage
       FROM transactions t
       WHERE t.stock_id = $1 AND t.user_id = $2
       ORDER BY t.executed_at ASC`,
      [req.params.id, req.params.holderId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT edit a transaction (adjusts holdings accordingly)
router.put('/:id/transactions/:txnId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { quantity, price, notes, executed_at, brokerage } = req.body;
    const stockId = req.params.id;
    const txnId = req.params.txnId;

    const { rows: [old] } = await query(
      `SELECT * FROM transactions WHERE id = $1 AND stock_id = $2`,
      [txnId, stockId]
    );
    if (!old) return res.status(404).json({ error: 'Transaction not found' });

    const newQty = parseFloat(quantity);
    const newPrice = parseFloat(price);
    const newTotal = parseFloat((newQty * newPrice).toFixed(4));
    const oldQty = parseFloat(old.quantity);
    const newBrokerage = old.type === 'sell' ? parseFloat(brokerage ?? old.brokerage ?? 0) : 0;

    const { rows: [updated] } = await query(
      `UPDATE transactions SET quantity = $1, price = $2, total = $3, notes = $4,
        executed_at = COALESCE($5::timestamptz, executed_at), brokerage = $6
       WHERE id = $7 RETURNING *`,
      [newQty, newPrice, newTotal, notes ?? old.notes, executed_at || null, newBrokerage, txnId]
    );

    if (old.type === 'sell') {
      // fewer sold → more remaining (or vice versa)
      await query(
        `UPDATE holdings SET quantity = quantity + $1 WHERE user_id = $2 AND stock_id = $3`,
        [oldQty - newQty, old.user_id, stockId]
      );
    } else {
      // buy: adjust quantity, recalc avg_buy_price from all remaining buys
      await query(
        `UPDATE holdings SET quantity = quantity + $1 WHERE user_id = $2 AND stock_id = $3`,
        [newQty - oldQty, old.user_id, stockId]
      );
      const { rows: [agg] } = await query(
        `SELECT SUM(quantity) AS total_qty, SUM(total) AS total_amt
         FROM transactions WHERE user_id = $1 AND stock_id = $2 AND type = 'buy'`,
        [old.user_id, stockId]
      );
      if (agg && parseFloat(agg.total_qty) > 0) {
        await query(
          `UPDATE holdings SET avg_buy_price = $1 WHERE user_id = $2 AND stock_id = $3`,
          [(parseFloat(agg.total_amt) / parseFloat(agg.total_qty)).toFixed(4), old.user_id, stockId]
        );
      }
    }

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE a transaction (reverses its effect on holdings)
router.delete('/:id/transactions/:txnId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const stockId = req.params.id;
    const txnId = req.params.txnId;

    const { rows: [txn] } = await query(
      `SELECT * FROM transactions WHERE id = $1 AND stock_id = $2`,
      [txnId, stockId]
    );
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const qty = parseFloat(txn.quantity);

    if (txn.type === 'sell') {
      await query(
        `UPDATE holdings SET quantity = quantity + $1 WHERE user_id = $2 AND stock_id = $3`,
        [qty, txn.user_id, stockId]
      );
    } else {
      await query(
        `UPDATE holdings SET quantity = quantity - $1 WHERE user_id = $2 AND stock_id = $3`,
        [qty, txn.user_id, stockId]
      );
    }

    await query(`DELETE FROM transactions WHERE id = $1`, [txnId]);

    if (txn.type === 'buy') {
      const { rows: [agg] } = await query(
        `SELECT SUM(quantity) AS total_qty, SUM(total) AS total_amt
         FROM transactions WHERE user_id = $1 AND stock_id = $2 AND type = 'buy'`,
        [txn.user_id, stockId]
      );
      if (agg && parseFloat(agg.total_qty) > 0) {
        await query(
          `UPDATE holdings SET avg_buy_price = $1 WHERE user_id = $2 AND stock_id = $3`,
          [(parseFloat(agg.total_amt) / parseFloat(agg.total_qty)).toFixed(4), txn.user_id, stockId]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET brokerage transactions for a stock
router.get('/:id/brokerage', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { group_id } = req.query;
    let q, params;
    if (group_id) {
      q = `SELECT * FROM brokerage_transactions WHERE stock_id = $1 AND group_id = $2 ORDER BY created_at ASC`;
      params = [req.params.id, group_id];
    } else {
      q = `SELECT * FROM brokerage_transactions WHERE stock_id = $1 AND group_id IS NULL ORDER BY created_at ASC`;
      params = [req.params.id];
    }
    const { rows } = await query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST add a brokerage transaction
router.post('/:id/brokerage', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { label, amount, group_id } = req.body;
    if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: 'amount is required' });
    const { rows } = await query(
      `INSERT INTO brokerage_transactions (stock_id, label, amount, group_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, label || null, parseFloat(amount), group_id || null]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE a brokerage transaction
router.delete('/:id/brokerage/:tid', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query(
      `DELETE FROM brokerage_transactions WHERE id = $1 AND stock_id = $2`,
      [req.params.tid, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// GET groups for a stock
router.get('/:id/groups', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT g.*, COUNT(h.id)::int AS holder_count,
        u.name AS holder_name, u.email AS holder_email
       FROM stock_groups g
       LEFT JOIN holdings h ON h.group_id = g.id
       LEFT JOIN users u ON u.id = g.holder_id
       WHERE g.stock_id = $1
       GROUP BY g.id, u.name, u.email ORDER BY g.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create a group for a stock
router.post('/:id/groups', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: 'label required' });
    const { rows } = await query(
      `INSERT INTO stock_groups (stock_id, label) VALUES ($1, $2) RETURNING *`,
      [req.params.id, label]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update group settled flags
router.put('/:id/groups/:gid', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { investment_settled, pnl_settled, holder_id } = req.body;
    const { rows } = await query(
      `UPDATE stock_groups SET
        investment_settled = COALESCE($1::boolean, investment_settled),
        pnl_settled = COALESCE($2::boolean, pnl_settled),
        holder_id = CASE WHEN $3::text = '__clear__' THEN NULL WHEN $3::text IS NOT NULL THEN $3::integer ELSE holder_id END
       WHERE id = $4 AND stock_id = $5 RETURNING *`,
      [investment_settled ?? null, pnl_settled ?? null, holder_id !== undefined ? (holder_id === null ? '__clear__' : String(holder_id)) : null, req.params.gid, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Group not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE a group (nullifies holdings group_id via ON DELETE SET NULL)
router.delete('/:id/groups/:gid', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query(`DELETE FROM stock_groups WHERE id = $1 AND stock_id = $2`, [req.params.gid, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT assign a holder to a group
router.put('/:id/holders/:holderId/group', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { group_id } = req.body;
    await query(
      `UPDATE holdings SET group_id = $1 WHERE user_id = $2 AND stock_id = $3`,
      [group_id || null, req.params.holderId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
