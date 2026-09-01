const router = require('express').Router();
const { query, pool } = require('../db');
const { authenticate, requireRole, requireRoleOrShareholder } = require('../middleware/auth');

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function fetchYahooPrice(symbol) {
  let base = symbol.toUpperCase().trim();

  // Normalise BSE prefix variants: BOM:530951 or BSE:530951 → 530951.BO
  const bseMatch = base.match(/^(?:BOM|BSE):(.+)$/);
  if (bseMatch) base = bseMatch[1];

  // Build candidate symbols — BSE first if it looks like a numeric code
  const isNumeric = /^\d+$/.test(base);
  const candidates = isNumeric
    ? [base + '.BO', base + '.NS', base]
    : [base + '.NS', base + '.BO', base];

  for (const sym of candidates) {
    try {
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

// GET stock info from Yahoo Finance by symbol (for new stock lookup)
router.get('/lookup', authenticate, async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const data = await fetchYahooPrice(symbol);
    if (!data) return res.status(404).json({ error: 'Symbol not found on Yahoo Finance' });
    res.json({ name: data.name, sector: data.sector, price: data.price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
router.get('/all', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT s.*,
        (SELECT MIN(t.executed_at) FROM transactions t WHERE t.stock_id = s.id AND t.type = 'buy') AS first_investment_date,
        (SELECT MAX(t.executed_at) FROM transactions t WHERE t.stock_id = s.id AND t.type = 'sell') AS last_sell_date,
        u.id AS holder_id, u.name AS holder_name, u.email AS holder_email, u.user_type AS holder_user_type,
        (SELECT CASE WHEN COUNT(DISTINCT h.avg_buy_price) = 1 THEN MIN(h.avg_buy_price) ELSE NULL END
         FROM holdings h WHERE h.stock_id = s.id) AS common_buy_price,
        EXISTS (
          SELECT 1 FROM holdings h WHERE h.stock_id = s.id AND ROUND(h.quantity::numeric, 2) > 0
        ) AS has_active_investors,
        EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.stock_id = s.id AND t.type = 'buy'
          AND t.investment_settled = false
          AND NOT (t.investment_settled = true AND t.pnl_settled = true)
        ) AS has_unsettled_investment,
        EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.stock_id = s.id AND t.type = 'buy'
          AND COALESCE(t.pnl_settled, false) = false
          AND NOT (t.investment_settled = true AND t.pnl_settled = true)
          AND EXISTS (
            SELECT 1 FROM transactions sell
            WHERE sell.stock_id = s.id AND sell.type = 'sell'
            AND sell.user_id = t.user_id
            AND (sell.group_id = t.group_id OR (sell.group_id IS NULL AND t.group_id IS NULL))
          )
        ) AS has_unsettled_pnl,
        sa.stop_loss,
        sa.target
      FROM stocks s
      LEFT JOIN users u ON u.id = s.holder_user_id
      LEFT JOIN stock_alerts sa ON sa.stock_id = s.id AND sa.is_active = TRUE
      ORDER BY s.symbol`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET my own demat stockholdings (stocks where I am the holder_id in stock_groups)
router.get('/my-demat', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        s.id AS stock_id, s.symbol, s.name AS stock_name, s.sector, s.current_price, s.is_active,
        g.id AS group_id, g.label AS group_label,
        COALESCE(BOOL_AND(t.investment_settled) FILTER (WHERE t.type = 'buy'), false) AS investment_settled,
        COALESCE(BOOL_AND(t.pnl_settled) FILTER (WHERE t.type = 'buy'), false) AS pnl_settled,
        COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'buy'), 0) AS total_bought,
        COALESCE(SUM(t.total) FILTER (WHERE t.type = 'buy'), 0) AS total_invested,
        COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'sell'), 0) AS total_sold,
        COALESCE(SUM(t.total) FILTER (WHERE t.type = 'sell'), 0) AS total_sell_amount,
        MIN(t.executed_at) FILTER (WHERE t.type = 'buy') AS first_buy_date,
        MAX(t.executed_at) FILTER (WHERE t.type = 'sell') AS last_sell_date
      FROM stock_groups g
      JOIN stocks s ON s.id = g.stock_id
      LEFT JOIN transactions t ON t.group_id = g.id
      WHERE g.holder_id = $1
      GROUP BY s.id, s.symbol, s.name, s.sector, s.current_price, s.is_active,
               g.id, g.label, g.investment_settled, g.pnl_settled
      ORDER BY s.symbol ASC, g.created_at ASC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET demat for any user — accessible by admin or shareholder
router.get('/demat/:userId', authenticate, async (req, res) => {
  try {
    const isShareholder = req.user.user_type === 'shareholder';
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin && !isShareholder) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await query(`
      SELECT
        s.id AS stock_id, s.symbol, s.name AS stock_name, s.sector, s.current_price, s.is_active,
        g.id AS group_id, g.label AS group_label,
        COALESCE(BOOL_AND(t.investment_settled) FILTER (WHERE t.type = 'buy'), false) AS investment_settled,
        COALESCE(BOOL_AND(t.pnl_settled) FILTER (WHERE t.type = 'buy'), false) AS pnl_settled,
        COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'buy'), 0) AS total_bought,
        COALESCE(SUM(t.total) FILTER (WHERE t.type = 'buy'), 0) AS total_invested,
        COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'sell'), 0) AS total_sold,
        COALESCE(SUM(t.total) FILTER (WHERE t.type = 'sell'), 0) AS total_sell_amount,
        MIN(t.executed_at) FILTER (WHERE t.type = 'buy') AS first_buy_date,
        MAX(t.executed_at) FILTER (WHERE t.type = 'sell') AS last_sell_date
      FROM stock_groups g
      JOIN stocks s ON s.id = g.stock_id
      LEFT JOIN transactions t ON t.group_id = g.id
      WHERE g.holder_id = $1
      GROUP BY s.id, s.symbol, s.name, s.sector, s.current_price, s.is_active,
               g.id, g.label, g.investment_settled, g.pnl_settled
      ORDER BY s.symbol ASC, g.created_at ASC
    `, [req.params.userId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all users who are holders in any stock group (for brokerage accounts page)
router.get('/brokerage-accounts/holders', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.user_type, u.role,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.group_id = g.id AND t.type = 'buy'
              AND (t.investment_settled = false OR t.pnl_settled = false)
          ) THEN g.stock_id END)::int AS active_stock_count
      FROM users u
      JOIN stock_groups g ON g.holder_id = u.id
      GROUP BY u.id, u.name, u.email, u.user_type, u.role
      ORDER BY u.name ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all stocks/groups for a specific holder user
router.get('/brokerage-accounts/holder/:userId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        s.id AS stock_id, s.symbol, s.name AS stock_name, s.sector, s.current_price, s.is_active,
        g.id AS group_id, g.label AS group_label,
        COALESCE(BOOL_AND(t.investment_settled) FILTER (WHERE t.type = 'buy'), false) AS investment_settled,
        COALESCE(BOOL_AND(t.pnl_settled) FILTER (WHERE t.type = 'buy'), false) AS pnl_settled,
        COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'buy'), 0) AS total_bought,
        COALESCE(SUM(t.total) FILTER (WHERE t.type = 'buy'), 0) AS total_invested,
        COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'sell'), 0) AS total_sold,
        COALESCE(SUM(t.quantity * t.price) FILTER (WHERE t.type = 'sell'), 0) AS total_sell_amount,
        COUNT(DISTINCT t.user_id) FILTER (WHERE t.type = 'buy')::int AS investor_count,
        MIN(t.executed_at) FILTER (WHERE t.type = 'buy') AS first_buy_date,
        MAX(t.executed_at) FILTER (WHERE t.type = 'sell') AS last_sell_date
      FROM stock_groups g
      JOIN stocks s ON s.id = g.stock_id
      LEFT JOIN transactions t ON t.group_id = g.id
      WHERE g.holder_id = $1
      GROUP BY s.id, s.symbol, s.name, s.sector, s.current_price, s.is_active,
               g.id, g.label
      ORDER BY s.symbol ASC, g.created_at ASC
    `, [req.params.userId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET holders of a specific stock (who invested and how much)
router.get('/:id/holders', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
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
        CASE WHEN ROUND(h.quantity::numeric, 2) > 0 THEN 'active' ELSE 'exited' END AS status,
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

// GET individual investments (buy transactions) for a stock — one row per investment
router.get('/:id/investments', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        t.id AS txn_id,
        u.id,
        u.name, u.email, u.user_type, u.role,
        t.group_id,
        (SELECT sg.label FROM stock_groups sg WHERE sg.id = t.group_id) AS group_label,
        s.current_price,
        -- Per-investment fields (aliased to match holder field names for table compatibility)
        t.quantity,
        t.quantity AS total_bought_quantity,
        t.price AS avg_buy_price,
        t.total AS invested_amount,
        t.total AS total_buy_amount,
        t.executed_at AS first_buy_date,
        ROUND((t.quantity * s.current_price)::numeric, 2) AS current_value,
        ROUND((t.quantity * s.current_price - t.total)::numeric, 2) AS unrealized_pnl,
        CASE WHEN t.total > 0
          THEN ROUND(((t.quantity * s.current_price - t.total) / t.total * 100)::numeric, 2)
          ELSE 0 END AS pnl_percent,
        CASE WHEN ROUND(COALESCE((
          SELECT SUM(sel.quantity) FROM transactions sel
          WHERE sel.user_id = t.user_id AND sel.stock_id = t.stock_id
            AND sel.type = 'sell' AND sel.group_id IS NOT DISTINCT FROM t.group_id
        ), 0)::numeric, 2) >= ROUND(t.quantity::numeric, 2) THEN 'exited' ELSE 'active' END AS status,
        GREATEST(0, ROUND((t.quantity - COALESCE((
          SELECT SUM(sel.quantity) FROM transactions sel
          WHERE sel.user_id = t.user_id AND sel.stock_id = t.stock_id
            AND sel.type = 'sell' AND sel.group_id IS NOT DISTINCT FROM t.group_id
        ), 0))::numeric, 2)) AS remaining_quantity,
        -- Per-group sell aggregates
        COALESCE((SELECT SUM(sel.quantity * sel.price) FROM transactions sel
          WHERE sel.user_id = t.user_id AND sel.stock_id = t.stock_id
            AND sel.type = 'sell' AND sel.group_id IS NOT DISTINCT FROM t.group_id), 0) AS total_sell_amount,
        COALESCE((SELECT SUM(sel.brokerage) FROM transactions sel
          WHERE sel.user_id = t.user_id AND sel.stock_id = t.stock_id
            AND sel.type = 'sell' AND sel.group_id IS NOT DISTINCT FROM t.group_id), 0) AS total_sell_brokerage,
        COALESCE((SELECT SUM(sel.quantity * sel.price) - SUM(sel.quantity) * t.price FROM transactions sel
          WHERE sel.user_id = t.user_id AND sel.stock_id = t.stock_id
            AND sel.type = 'sell' AND sel.group_id IS NOT DISTINCT FROM t.group_id), 0) AS realized_pnl,
        (SELECT ROUND((SUM(sel.quantity * sel.price) / NULLIF(SUM(sel.quantity), 0))::numeric, 2) FROM transactions sel
          WHERE sel.user_id = t.user_id AND sel.stock_id = t.stock_id
            AND sel.type = 'sell' AND sel.group_id IS NOT DISTINCT FROM t.group_id) AS avg_sell_price,
        (SELECT MAX(sel.executed_at) FROM transactions sel
          WHERE sel.user_id = t.user_id AND sel.stock_id = t.stock_id
            AND sel.type = 'sell' AND sel.group_id IS NOT DISTINCT FROM t.group_id) AS last_sell_date,
        t.notes,
        t.investment_settled,
        t.pnl_settled
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      JOIN stocks s ON s.id = t.stock_id
      LEFT JOIN holdings h ON h.user_id = t.user_id AND h.stock_id = t.stock_id
      WHERE t.stock_id = $1 AND t.type = 'buy'
      ORDER BY t.executed_at DESC, u.name ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET single stock by id (admin, and shareholders read-only)
router.get('/:id', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
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
    const { symbol, name, sector, current_price, market_cap_category } = req.body;
    if (!symbol || !name) return res.status(400).json({ error: 'symbol and name required' });
    const { rows } = await query(
      `INSERT INTO stocks (symbol, name, sector, current_price, previous_close, last_updated, market_cap_category)
       VALUES ($1, $2, $3, $4, $4, NOW(), $5) RETURNING *`,
      [symbol.toUpperCase(), name, sector || null, current_price || 0, market_cap_category || null]
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
    const { name, sector, current_price, is_active, investment_settled, pnl_settled, brokerage, market_cap_category } = req.body;
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
        market_cap_category = COALESCE($9::varchar, market_cap_category),
        last_updated = NOW()
       WHERE id = $5 RETURNING *`,
      [name ?? null, sector ?? null, current_price ?? null, is_active ?? null, req.params.id,
       investment_settled ?? null, pnl_settled ?? null, brokerage ?? null, market_cap_category ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stock not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /stocks/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all sell transactions for a stock (optionally filtered by group)
router.get('/:id/sell-transactions', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
  try {
    const { group_id } = req.query;
    const params = [req.params.id];
    let sql = `
      SELECT t.id, t.user_id, u.name AS user_name, t.quantity, t.price, t.total, t.brokerage, t.executed_at, t.notes, t.group_id
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      WHERE t.stock_id = $1 AND t.type = 'sell'
    `;
    if (group_id) { params.push(group_id); sql += ` AND t.group_id = $${params.length}`; }
    sql += ` ORDER BY u.name ASC, t.executed_at ASC`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST transfer shares from one holder to another (admin only)
router.post('/:id/transfer', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  const stockId = req.params.id;
  const { from_user_id, to_user_id, quantity, exit_price, buy_price, executed_at, notes, from_group_id } = req.body;
  if (!from_user_id || !to_user_id || !quantity || !exit_price || !buy_price) {
    return res.status(400).json({ error: 'from_user_id, to_user_id, quantity, exit_price, buy_price required' });
  }
  if (String(from_user_id) === String(to_user_id)) {
    return res.status(400).json({ error: 'Cannot transfer shares to the same person' });
  }
  const qty = parseFloat(quantity);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [fromUser] } = await client.query('SELECT name FROM users WHERE id = $1', [from_user_id]);
    const { rows: [toUser] } = await client.query('SELECT name FROM users WHERE id = $1', [to_user_id]);
    if (!fromUser || !toUser) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

    const { rows: [fromHolding] } = await client.query(
      'SELECT quantity FROM holdings WHERE user_id = $1 AND stock_id = $2', [from_user_id, stockId]
    );
    const held = parseFloat(fromHolding?.quantity || 0);
    if (held < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient shares. Available: ${held}` });
    }

    const txExecAt = executed_at || new Date().toISOString();
    const sellTotal = parseFloat((qty * parseFloat(exit_price)).toFixed(2));
    const buyTotal = parseFloat((qty * parseFloat(buy_price)).toFixed(2));

    await client.query(
      `INSERT INTO transactions (user_id, stock_id, type, quantity, price, total, notes, executed_at, created_by, brokerage, group_id)
       VALUES ($1, $2, 'sell', $3, $4, $5, $6, $7, $8, 0, $9)`,
      [from_user_id, stockId, qty, exit_price, sellTotal, notes || `Transferred to ${toUser.name}`, txExecAt, req.user.id, from_group_id || null]
    );
    await client.query(
      `UPDATE holdings SET quantity = quantity - $1, updated_at = NOW() WHERE user_id = $2 AND stock_id = $3`,
      [qty, from_user_id, stockId]
    );
    await client.query('INSERT INTO balances (user_id, cash_balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [from_user_id]);
    await client.query('UPDATE balances SET cash_balance = cash_balance + $1, updated_at = NOW() WHERE user_id = $2', [sellTotal, from_user_id]);

    await client.query(
      `INSERT INTO transactions (user_id, stock_id, type, quantity, price, total, notes, executed_at, created_by, brokerage, group_id)
       VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7, $8, 0, $9)`,
      [to_user_id, stockId, qty, buy_price, buyTotal, notes || `Transferred from ${fromUser.name}`, txExecAt, req.user.id, from_group_id || null]
    );
    await client.query(
      `INSERT INTO holdings (user_id, stock_id, quantity, avg_buy_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, stock_id) DO UPDATE SET
         avg_buy_price = (holdings.avg_buy_price * holdings.quantity + $4 * $3) / (holdings.quantity + $3),
         quantity = holdings.quantity + $3,
         updated_at = NOW()`,
      [to_user_id, stockId, qty, buy_price]
    );
    await client.query('INSERT INTO balances (user_id, cash_balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [to_user_id]);
    await client.query('UPDATE balances SET cash_balance = cash_balance - $1, updated_at = NOW() WHERE user_id = $2', [buyTotal, to_user_id]);

    const { rows: [remaining] } = await client.query(
      'SELECT COUNT(*) FROM holdings WHERE stock_id = $1 AND ROUND(quantity::numeric, 2) > 0', [stockId]
    );
    if (parseInt(remaining.count) === 0) {
      await client.query('UPDATE stocks SET is_active = false, last_updated = NOW() WHERE id = $1', [stockId]);
    } else {
      await client.query('UPDATE stocks SET is_active = true, last_updated = NOW() WHERE id = $1', [stockId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET transaction history for a specific holder in a stock
router.get('/:id/holders/:holderId/transactions', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
  try {
    const { group_id } = req.query;
    let sql, params;
    if (group_id) {
      // Show only transactions (buy and sell) belonging to this group
      sql = `SELECT t.id, t.type, t.quantity, t.price, t.total, t.notes, t.executed_at, COALESCE(t.brokerage, 0) AS brokerage, t.group_id
             FROM transactions t
             WHERE t.stock_id = $1 AND t.user_id = $2
               AND t.group_id = $3
             ORDER BY t.executed_at ASC`;
      params = [req.params.id, req.params.holderId, group_id];
    } else {
      sql = `SELECT t.id, t.type, t.quantity, t.price, t.total, t.notes, t.executed_at, COALESCE(t.brokerage, 0) AS brokerage, t.group_id
             FROM transactions t
             WHERE t.stock_id = $1 AND t.user_id = $2
             ORDER BY t.executed_at ASC`;
      params = [req.params.id, req.params.holderId];
    }
    const { rows } = await query(sql, params);
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
    const newTotal = parseFloat((newQty * newPrice).toFixed(2));
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
          [(parseFloat(agg.total_amt) / parseFloat(agg.total_qty)).toFixed(2), old.user_id, stockId]
        );
      }
    }

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update per-investor settled flags
router.patch('/:id/transactions/:txnId/settled', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { investment_settled, pnl_settled } = req.body;
    const { rows: [row] } = await query(
      `UPDATE transactions SET
        investment_settled = COALESCE($1::boolean, investment_settled),
        pnl_settled = COALESCE($2::boolean, pnl_settled)
       WHERE id = $3 AND stock_id = $4 RETURNING investment_settled, pnl_settled`,
      [investment_settled ?? null, pnl_settled ?? null, req.params.txnId, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Transaction not found' });
    res.json(row);
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
      // Check remaining holding quantity
      const { rows: [holding] } = await query(
        `SELECT quantity FROM holdings WHERE user_id = $1 AND stock_id = $2`,
        [txn.user_id, stockId]
      );
      if (holding && Math.round(parseFloat(holding.quantity) * 100) / 100 <= 0) {
        // No shares left — remove the holding entirely
        await query(
          `DELETE FROM holdings WHERE user_id = $1 AND stock_id = $2`,
          [txn.user_id, stockId]
        );
      } else {
        // Recalculate avg_buy_price from remaining buy transactions
        const { rows: [agg] } = await query(
          `SELECT SUM(quantity) AS total_qty, SUM(total) AS total_amt
           FROM transactions WHERE user_id = $1 AND stock_id = $2 AND type = 'buy'`,
          [txn.user_id, stockId]
        );
        if (agg && parseFloat(agg.total_qty) > 0) {
          await query(
            `UPDATE holdings SET avg_buy_price = $1 WHERE user_id = $2 AND stock_id = $3`,
            [(parseFloat(agg.total_amt) / parseFloat(agg.total_qty)).toFixed(2), txn.user_id, stockId]
          );
        }
      }
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET brokerage transactions for a stock
router.get('/:id/brokerage', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
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

// PUT update a brokerage transaction
router.put('/:id/brokerage/:tid', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { amount, label } = req.body;
    const { rows } = await query(
      `UPDATE brokerage_transactions SET amount = $1, label = COALESCE($2, label) WHERE id = $3 AND stock_id = $4 RETURNING *`,
      [parseFloat(amount), label ?? null, req.params.tid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
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
router.get('/:id/groups', authenticate, requireRoleOrShareholder('admin', 'super_admin'), async (req, res) => {
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
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
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
