const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET all relationships
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.id, r.shareholder_id, r.client_id, r.created_at,
             sh.name as shareholder_name, sh.email as shareholder_email,
             cl.name as client_name, cl.email as client_email, cl.scheme as client_scheme
      FROM relationships r
      JOIN users sh ON sh.id = r.shareholder_id
      JOIN users cl ON cl.id = r.client_id
      ORDER BY sh.name, cl.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all clients — admin sees all; shareholder sees own unless ?scope=all
router.get('/all-clients', authenticate, async (req, res) => {
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  const isShareholder = req.user.user_type === 'shareholder';
  if (!isAdmin && !isShareholder) return res.status(403).json({ error: 'Forbidden' });

  const scopeAll = isAdmin || req.query.scope === 'all';

  try {
    const params = scopeAll ? [] : [req.user.id];
    const extraJoin = scopeAll ? '' : 'LEFT JOIN relationships r2 ON r2.client_id = u.id';
    const whereClause = scopeAll
      ? `WHERE u.user_type = 'client'`
      : `WHERE u.user_type = 'client' AND r2.shareholder_id = $1`;

    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.phone, u.user_type, u.is_active, u.created_at,
             COALESCE(
               NULLIF(STRING_AGG(DISTINCT us.scheme, ',' ORDER BY us.scheme) FILTER (WHERE us.is_active = true), ''),
               NULL
             ) as scheme,
             COALESCE(SUM(CASE WHEN ROUND(h.quantity::numeric, 2) > 0 THEN h.quantity * s.current_price ELSE 0 END), 0) as portfolio_value,
             COALESCE(SUM(CASE WHEN ROUND(h.quantity::numeric, 2) > 0 THEN h.quantity * h.avg_buy_price ELSE 0 END), 0) as active_invested,
             COALESCE(SUM(CASE WHEN ROUND(h.quantity::numeric, 2) > 0 THEN h.quantity * s.current_price - h.quantity * h.avg_buy_price ELSE 0 END), 0) as unrealized_pnl,
             COALESCE((
               SELECT SUM(CASE WHEN fm.type = 'deposit' THEN fm.amount ELSE -fm.amount END)
               FROM fund_movements fm WHERE fm.user_id = u.id
             ), 0) as total_deposited,
             COALESCE((
               SELECT ROUND(SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE -t.total END)::numeric, 2)
               FROM transactions t
               JOIN (
                 SELECT h2.stock_id FROM holdings h2
                 WHERE h2.user_id = u.id AND ROUND(h2.quantity::numeric, 2) <= 0
               ) exited ON exited.stock_id = t.stock_id
               WHERE t.user_id = u.id
             ), 0) as realized_pnl,
             COALESCE((
               SELECT SUM(CASE WHEN fm.type = 'deposit' THEN fm.amount ELSE -fm.amount END)
               FROM fund_movements fm WHERE fm.user_id = u.id
             ), 0)
             - COALESCE(SUM(CASE WHEN ROUND(h.quantity::numeric, 2) > 0 THEN h.quantity * h.avg_buy_price ELSE 0 END), 0)
             + COALESCE((
               SELECT ROUND(SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE -t.total END)::numeric, 2)
               FROM transactions t
               JOIN (
                 SELECT h2.stock_id FROM holdings h2
                 WHERE h2.user_id = u.id AND ROUND(h2.quantity::numeric, 2) <= 0
               ) exited2 ON exited2.stock_id = t.stock_id
               WHERE t.user_id = u.id
             ), 0) as cash_balance,
             sh.name as shareholder_name, sh.id as shareholder_id
      FROM users u
      LEFT JOIN user_schemes us ON us.user_id = u.id
      LEFT JOIN holdings h ON h.user_id = u.id
      LEFT JOIN stocks s ON s.id = h.stock_id
      LEFT JOIN relationships r ON r.client_id = u.id
      LEFT JOIN users sh ON sh.id = r.shareholder_id
      ${extraJoin}
      ${whereClause}
      GROUP BY u.id, u.name, u.email, u.phone, u.user_type, u.is_active, u.created_at, sh.name, sh.id
      ORDER BY u.name
    `, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET clients managed by a specific shareholder
router.get('/shareholder/:id', authenticate, async (req, res) => {
  try {
    const shareholderId = req.params.id === 'me' ? req.user.id : req.params.id;
    // Non-admin shareholders can only see their own clients
    if (req.user.role === 'user' && req.user.user_type === 'shareholder' && shareholderId != req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at,
             COALESCE(
               NULLIF(STRING_AGG(DISTINCT us.scheme, ',' ORDER BY us.scheme) FILTER (WHERE us.is_active = true), ''),
               NULL
             ) as scheme,
             b.cash_balance,
             COALESCE(SUM(CASE WHEN ROUND(h.quantity::numeric, 2) > 0 THEN h.quantity * s.current_price ELSE 0 END), 0) as portfolio_value
      FROM relationships r
      JOIN users u ON u.id = r.client_id
      LEFT JOIN user_schemes us ON us.user_id = u.id
      LEFT JOIN balances b ON b.user_id = u.id
      LEFT JOIN holdings h ON h.user_id = u.id
      LEFT JOIN stocks s ON s.id = h.stock_id
      WHERE r.shareholder_id = $1
      GROUP BY u.id, u.name, u.email, u.phone, u.is_active, u.created_at, b.cash_balance
      ORDER BY u.name
    `, [shareholderId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST assign client to shareholder
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { shareholder_id, client_id } = req.body;
    const { rows } = await query(
      `INSERT INTO relationships (shareholder_id, client_id) VALUES ($1, $2)
       ON CONFLICT (client_id) DO UPDATE SET shareholder_id = $1
       RETURNING *`,
      [shareholder_id, client_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE relationship
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM relationships WHERE id = $1', [req.params.id]);
    res.json({ message: 'Relationship removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
