const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// Ensure extra columns exist
query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS scheme VARCHAR(100)`).catch(console.error);
query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS proof_type VARCHAR(50)`).catch(console.error);
query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS proof VARCHAR(255)`).catch(console.error);
query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terminated_at DATE`).catch(console.error);

// GET all users (admin/super_admin)
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { type, role } = req.query;
    let sql = `SELECT u.id, u.name, u.email, u.user_type, u.role, u.phone, u.scheme, u.proof_type, u.proof, u.is_active, u.terminated_at, u.created_at,
               r.shareholder_id,
               sh.name as shareholder_name
               FROM users u
               LEFT JOIN relationships r ON r.client_id = u.id
               LEFT JOIN users sh ON sh.id = r.shareholder_id
               WHERE 1=1`;
    const params = [];
    if (type) { params.push(type); sql += ` AND u.user_type = $${params.length}`; }
    if (role) { params.push(role); sql += ` AND u.role = $${params.length}`; }
    sql += ' ORDER BY u.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single user
router.get('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.user_type, u.role, u.phone, u.is_active, u.created_at,
       r.shareholder_id, sh.name as shareholder_name
       FROM users u
       LEFT JOIN relationships r ON r.client_id = u.id
       LEFT JOIN users sh ON sh.id = r.shareholder_id
       WHERE u.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create user
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { name, email, password, user_type, role = 'user', phone, scheme, proof_type, proof } = req.body;
    if (!name || !email || !password || !user_type) {
      return res.status(400).json({ error: 'name, email, password, user_type required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, user_type, role, phone, scheme, proof_type, proof)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, email, user_type, role, phone, scheme, proof_type, proof, created_at`,
      [name, email.toLowerCase(), hash, user_type, role, phone || null, scheme || null, proof_type || null, proof || null]
    );
    // Create balance record
    await query('INSERT INTO balances (user_id, cash_balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update user
router.put('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { name, email, user_type, role, phone, scheme, proof_type, proof, is_active, terminated_at } = req.body;
    const { rows } = await query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email),
       user_type = COALESCE($3, user_type), role = COALESCE($4, role),
       phone = COALESCE($5, phone),
       scheme = COALESCE($6, scheme), proof_type = COALESCE($7, proof_type), proof = COALESCE($8, proof),
       is_active = COALESCE($9, is_active), terminated_at = COALESCE($10, terminated_at), updated_at = NOW()
       WHERE id = $11 RETURNING id, name, email, user_type, role, phone, scheme, proof_type, proof, is_active, terminated_at`,
      [name, email, user_type, role, phone, scheme || null, proof_type || null, proof || null, is_active, terminated_at || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT change own password (any authenticated user)
router.put('/me/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password required' });
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT reset password
router.put('/:id/reset-password', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { new_password } = req.body;
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE user
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
