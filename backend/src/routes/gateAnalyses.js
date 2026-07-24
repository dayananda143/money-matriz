const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET all saved gate analyses for the current admin
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, ticker, company, decision, results_json AS results, saved_at AS "savedAt"
       FROM gate_analyses WHERE user_id = $1 ORDER BY saved_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST save (or replace) a gate analysis for a ticker
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { ticker, company, decision, results } = req.body;
    if (!ticker || !results) return res.status(400).json({ error: 'ticker and results required' });
    const { rows } = await query(
      `INSERT INTO gate_analyses (user_id, ticker, company, decision, results_json, saved_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, ticker) DO UPDATE SET
         company = $3, decision = $4, results_json = $5, saved_at = NOW()
       RETURNING id, ticker, company, decision, results_json AS results, saved_at AS "savedAt"`,
      [req.user.id, ticker.toUpperCase(), company || null, decision || null, JSON.stringify(results)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a saved gate analysis
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query(`DELETE FROM gate_analyses WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
