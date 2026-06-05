const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/stock-alerts — all alerts (active + inactive)
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT sa.*, s.symbol, s.name, s.current_price,
             u.name AS created_by_name
      FROM stock_alerts sa
      JOIN stocks s ON s.id = sa.stock_id
      LEFT JOIN users u ON u.id = sa.created_by
      ORDER BY s.symbol
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/stock-alerts/:stockId — alert for a specific stock
router.get('/:stockId', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM stock_alerts WHERE stock_id = $1`,
      [req.params.stockId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// POST /api/stock-alerts — create or update alert for a stock
router.post('/', async (req, res) => {
  const { stock_id, stop_loss, target } = req.body;
  if (!stock_id) return res.status(400).json({ error: 'stock_id is required' });
  if (!stop_loss && !target) return res.status(400).json({ error: 'Provide stop_loss or target' });
  try {
    const { rows } = await query(`
      INSERT INTO stock_alerts (stock_id, stop_loss, target, created_by, is_active, updated_at)
      VALUES ($1, $2, $3, $4, TRUE, NOW())
      ON CONFLICT (stock_id) DO UPDATE
        SET stop_loss = EXCLUDED.stop_loss,
            target    = EXCLUDED.target,
            is_active = TRUE,
            updated_at = NOW()
      RETURNING *
    `, [stock_id, stop_loss || null, target || null, req.user.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save alert' });
  }
});

// PATCH /api/stock-alerts/:stockId/toggle — flip is_active
router.patch('/:stockId/toggle', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE stock_alerts SET is_active = NOT is_active, updated_at = NOW()
       WHERE stock_id = $1 RETURNING *`,
      [req.params.stockId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Alert not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle alert' });
  }
});

// DELETE /api/stock-alerts/:stockId — remove alert for a stock
router.delete('/:stockId', async (req, res) => {
  try {
    await query(
      `UPDATE stock_alerts SET is_active = FALSE, updated_at = NOW() WHERE stock_id = $1`,
      [req.params.stockId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

module.exports = router;
