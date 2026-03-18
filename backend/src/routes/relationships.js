const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET all relationships
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.id, r.shareholder_id, r.client_id, r.created_at,
             sh.name as shareholder_name, sh.email as shareholder_email,
             cl.name as client_name, cl.email as client_email
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

// GET all clients with shareholder info (admin/super_admin)
router.get('/all-clients', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.phone, u.user_type, u.is_active, u.created_at,
             COALESCE(b.cash_balance, 0) as cash_balance,
             COALESCE(SUM(CASE WHEN h.quantity > 0 THEN h.quantity * s.current_price ELSE 0 END), 0) as portfolio_value,
             sh.name as shareholder_name, sh.id as shareholder_id
      FROM users u
      LEFT JOIN balances b ON b.user_id = u.id
      LEFT JOIN holdings h ON h.user_id = u.id
      LEFT JOIN stocks s ON s.id = h.stock_id
      LEFT JOIN relationships r ON r.client_id = u.id
      LEFT JOIN users sh ON sh.id = r.shareholder_id
      WHERE u.user_type = 'client'
      GROUP BY u.id, u.name, u.email, u.phone, u.user_type, u.is_active, u.created_at, b.cash_balance, sh.name, sh.id
      ORDER BY u.name
    `);
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
             b.cash_balance,
             COALESCE(SUM(h.quantity * s.current_price), 0) as portfolio_value
      FROM relationships r
      JOIN users u ON u.id = r.client_id
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
