const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function fetchLivePrice(symbol) {
  const base = symbol.toUpperCase().trim();
  const isNumeric = /^\d+$/.test(base);
  const candidates = isNumeric ? [base + '.BO', base + '.NS', base] : [base + '.NS', base + '.BO', base];
  for (const sym of candidates) {
    try {
      const q = await yf.quote(sym, {}, { validateResult: false });
      if (q?.regularMarketPrice) return q.regularMarketPrice;
    } catch {}
  }
  return null;
}

// GET all trade requests
// - admin/shareholder: sees all requests with user info
// - client: sees only their own
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const isShareholder = req.user.user_type === 'shareholder';
    const { status } = req.query;

    let sql = `
      SELECT tr.*, u.name as user_name, u.email as user_email, u.user_type,
             rv.name as reviewed_by_name
      FROM trade_requests tr
      JOIN users u ON u.id = tr.user_id
      LEFT JOIN users rv ON rv.id = tr.reviewed_by
      WHERE 1=1
    `;
    const params = [];

    if (!isAdmin && !isShareholder) {
      params.push(req.user.id);
      sql += ` AND tr.user_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND tr.status = $${params.length}`;
    }

    sql += ' ORDER BY tr.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST submit a new trade request (any authenticated user)
router.post('/', authenticate, async (req, res) => {
  try {
    const { stock_symbol, stock_name, quantity, buy_price, amount, notes } = req.body;
    if (!stock_symbol || !quantity || !buy_price || !amount) {
      return res.status(400).json({ error: 'stock_symbol, quantity, buy_price, amount required' });
    }
    const { rows } = await query(
      `INSERT INTO trade_requests (user_id, stock_symbol, stock_name, quantity, buy_price, amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, stock_symbol.toUpperCase(), stock_name || null, quantity, buy_price, amount, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT edit a trade request — own pending requests OR admin/super_admin
router.put('/:id', authenticate, async (req, res) => {
  try {
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const { rows: existing } = await query('SELECT * FROM trade_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Request not found' });

    const isOwner = existing[0].user_id === req.user.id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Forbidden' });
    if (!isAdmin && existing[0].status !== 'pending') return res.status(400).json({ error: 'Can only edit pending requests' });

    const { stock_symbol, stock_name, quantity, buy_price, amount, notes } = req.body;
    const { rows } = await query(
      `UPDATE trade_requests SET
         stock_symbol = COALESCE($1, stock_symbol),
         stock_name   = COALESCE($2, stock_name),
         quantity     = COALESCE($3, quantity),
         buy_price    = COALESCE($4, buy_price),
         amount       = COALESCE($5, amount),
         notes        = $6
       WHERE id = $7 RETURNING *`,
      [stock_symbol ? stock_symbol.toUpperCase() : null, stock_name || null, quantity || null, buy_price || null, amount || null, notes ?? existing[0].notes, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a trade request — admin/super_admin or the owner
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const { rows } = await query('SELECT user_id FROM trade_requests WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    const isOwner = rows[0].user_id === req.user.id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM trade_requests WHERE id = $1', [req.params.id]);
    res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT approve a trade request — admin/shareholder only
// Body: { stock_id, quantity, price, total, notes, executed_at }
router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const isShareholder = req.user.user_type === 'shareholder';
    if (!isAdmin && !isShareholder) return res.status(403).json({ error: 'Forbidden' });

    const { rows: reqRows } = await query('SELECT * FROM trade_requests WHERE id = $1', [req.params.id]);
    if (!reqRows[0]) return res.status(404).json({ error: 'Request not found' });
    if (reqRows[0].status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

    const tradeReq = reqRows[0];
    const { quantity, price, total, notes, executed_at } = req.body;
    let { stock_id, stock_symbol, stock_name, stock_sector } = req.body;
    if (!quantity || !price) {
      return res.status(400).json({ error: 'quantity and price required' });
    }

    // Resolve stock — use stock_id if provided, otherwise find/create by symbol
    if (!stock_id) {
      const sym = (stock_symbol || tradeReq.stock_symbol).toUpperCase();
      const { rows: existing } = await query('SELECT id FROM stocks WHERE symbol = $1', [sym]);
      if (existing[0]) {
        stock_id = existing[0].id;
        // Refresh current price from live feed
        const livePrice = await fetchLivePrice(sym);
        if (livePrice) {
          await query('UPDATE stocks SET current_price = $1, last_updated = NOW() WHERE id = $2', [livePrice, stock_id]);
        }
      } else {
        // Create new stock — fetch live price, fall back to bought price
        const name = stock_name || tradeReq.stock_name || sym;
        const sector = stock_sector || null;
        const livePrice = await fetchLivePrice(sym);
        const currentPrice = livePrice || parseFloat(price);
        const { rows: created } = await query(
          `INSERT INTO stocks (symbol, name, sector, current_price, previous_close, is_active)
           VALUES ($1, $2, $3, $4, $4, true) RETURNING id`,
          [sym, name, sector, currentPrice]
        );
        stock_id = created[0].id;
      }
    }

    // Mark request approved — store resolved details, admin will add actual trade later
    await query(
      `UPDATE trade_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Trade request approved and trade created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT reject a trade request — admin/shareholder only
router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const isShareholder = req.user.user_type === 'shareholder';
    if (!isAdmin && !isShareholder) return res.status(403).json({ error: 'Forbidden' });

    const { rejection_reason } = req.body;
    const { rows } = await query(
      `UPDATE trade_requests SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3 AND status = 'pending' RETURNING *`,
      [rejection_reason || null, req.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or already reviewed' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
