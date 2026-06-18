const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

let _io = null;
function setIo(io) { _io = io; }

router.use(authenticate);

// GET /api/notifications — current user's notifications (latest 50)
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT n.*, s.symbol, s.name AS stock_name
      FROM notifications n
      LEFT JOIN stocks s ON s.id = n.stock_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ count: parseInt(rows[0].count, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

// PUT /api/notifications/:id/read — mark single notification read
router.put('/:id/read', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// PUT /api/notifications/read-all — mark all notifications read
router.put('/read-all', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// PUT /api/notifications/:id/acknowledge — acknowledge a single notification
// Acknowledging a stop_loss/target notification also turns off the underlying
// stock alert, so it stops re-firing for that stock until re-armed on the Alerts page.
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE notifications SET is_acknowledged = TRUE, is_read = TRUE
       WHERE id = $1 AND user_id = $2 RETURNING alert_id`,
      [req.params.id, req.user.id]
    );
    const alertId = rows[0]?.alert_id;
    if (alertId) {
      await query(`UPDATE stock_alerts SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [alertId]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to acknowledge notification' });
  }
});

// PUT /api/notifications/acknowledge-all — acknowledge all notifications
router.put('/acknowledge-all', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE notifications SET is_acknowledged = TRUE, is_read = TRUE
       WHERE user_id = $1 AND is_acknowledged = FALSE RETURNING alert_id`,
      [req.user.id]
    );
    const alertIds = [...new Set(rows.map(r => r.alert_id).filter(Boolean))];
    if (alertIds.length) {
      await query(`UPDATE stock_alerts SET is_active = FALSE, updated_at = NOW() WHERE id = ANY($1)`, [alertIds]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to acknowledge all' });
  }
});

// DELETE /api/notifications — clear all notifications for current user
router.delete('/', async (req, res) => {
  try {
    await query(`DELETE FROM notifications WHERE user_id = $1`, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// POST /api/notifications/test — send a test notification to the requesting user
router.post('/test', async (req, res) => {
  try {
    const { rows: stocks } = await query(`SELECT id, symbol, name FROM stocks WHERE is_active = TRUE LIMIT 1`);
    const stock = stocks[0];
    const type = req.body.type === 'stop_loss' ? 'stop_loss' : 'target';
    const message = stock
      ? `[TEST] ${stock.symbol} ${type === 'stop_loss' ? 'hit stop loss ₹150.00' : 'reached target ₹250.00'} — current price ₹200.00`
      : `[TEST] This is a test ${type === 'stop_loss' ? 'stop loss' : 'target'} notification`;

    const { rows: [notif] } = await query(`
      INSERT INTO notifications (user_id, stock_id, type, message, triggered_price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.id, stock?.id || null, type, message, 200]);

    if (_io) {
      _io.to(`user:${req.user.id}`).emit('notification', {
        ...notif,
        symbol: stock?.symbol,
        stock_name: stock?.name,
      });
    }

    res.json({ success: true, notification: notif });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

module.exports = { router, setIo };
