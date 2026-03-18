const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET all config (authenticated — needed by UsersPage dropdowns)
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query('SELECT key, values FROM platform_config ORDER BY key');
    const config = {};
    rows.forEach(r => { config[r.key] = r.values; });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update a config key (super_admin only)
router.put('/:key', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { values } = req.body;
    console.log(`[config PUT] key=${req.params.key} values=${JSON.stringify(values)} user=${req.user?.id} role=${req.user?.role}`);
    if (!Array.isArray(values)) {
      return res.status(400).json({ error: 'values must be an array' });
    }
    const { rows } = await query(
      `INSERT INTO platform_config (key, values, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET values = $2, updated_at = NOW()
       RETURNING *`,
      [req.params.key, JSON.stringify(values)]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
