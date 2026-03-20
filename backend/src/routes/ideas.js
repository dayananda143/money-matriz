const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const canAccess = (user) =>
  user.user_type === 'shareholder' || user.role === 'admin' || user.role === 'super_admin';

const isAdmin = (user) => user.role === 'admin' || user.role === 'super_admin';

// GET all ideas
router.get('/', authenticate, async (req, res) => {
  if (!canAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows } = await query(`
      SELECT i.*, u.name AS author_name, u.role AS author_role
      FROM ideas i
      JOIN users u ON u.id = i.user_id
      ORDER BY i.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create idea
router.post('/', authenticate, async (req, res) => {
  if (!canAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  try {
    const { rows } = await query(
      `INSERT INTO ideas (user_id, title, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, title, content]
    );
    const { rows: [idea] } = await query(
      `SELECT i.*, u.name AS author_name, u.role AS author_role FROM ideas i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(idea);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update idea
router.put('/:id', authenticate, async (req, res) => {
  if (!canAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });
  const { title, content, status } = req.body;
  try {
    const { rows: [idea] } = await query(`SELECT * FROM ideas WHERE id = $1`, [req.params.id]);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    if (idea.user_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
    if (status && !['pending', 'implemented'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'implemented' && !isAdmin(req.user)) return res.status(403).json({ error: 'Only admins can mark as implemented' });
    const { rows } = await query(
      `UPDATE ideas SET title = COALESCE($1, title), content = COALESCE($2, content), status = COALESCE($3, status), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [title || null, content || null, status || null, req.params.id]
    );
    const { rows: [updated] } = await query(
      `SELECT i.*, u.name AS author_name, u.role AS author_role FROM ideas i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [rows[0].id]
    );
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE idea
router.delete('/:id', authenticate, async (req, res) => {
  if (!canAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows: [idea] } = await query(`SELECT * FROM ideas WHERE id = $1`, [req.params.id]);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    if (idea.user_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
    await query(`DELETE FROM ideas WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
