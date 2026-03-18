const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// Super admin / admin overview
router.get('/overview', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const [usersRes, stocksRes, aumRes, txRes] = await Promise.all([
      query(`SELECT user_type, COUNT(*) as count FROM users WHERE is_active = true GROUP BY user_type`),
      query(`SELECT COUNT(*) as count FROM stocks WHERE is_active = true`),
      query(`SELECT COALESCE(SUM(cash_balance), 0) as total_cash FROM balances`),
      query(`SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as volume FROM transactions WHERE executed_at >= NOW() - INTERVAL '30 days'`)
    ]);

    const holdingsAum = await query(`
      SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as total
      FROM holdings h JOIN stocks s ON s.id = h.stock_id
    `);

    const clients = usersRes.rows.find(r => r.user_type === 'client')?.count || 0;
    const shareholders = usersRes.rows.find(r => r.user_type === 'shareholder')?.count || 0;

    res.json({
      total_clients: parseInt(clients),
      total_shareholders: parseInt(shareholders),
      total_stocks: parseInt(stocksRes.rows[0].count),
      total_cash_aum: parseFloat(aumRes.rows[0].total_cash),
      total_portfolio_aum: parseFloat(holdingsAum.rows[0].total),
      monthly_tx_count: parseInt(txRes.rows[0].count),
      monthly_tx_volume: parseFloat(txRes.rows[0].volume),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// All users with portfolio summary (admin/super_admin)
router.get('/all-users', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        u.id, u.name, u.email, u.user_type, u.role, u.is_active, u.created_at,
        COALESCE(b.cash_balance, 0) AS cash_balance,
        COALESCE(pv.portfolio_value, 0) AS portfolio_value,
        COALESCE(pv.portfolio_value, 0) + COALESCE(b.cash_balance, 0) AS total_value,
        COALESCE(tx.total_invested, 0) AS total_invested,
        COALESCE(pv.portfolio_value, 0) - COALESCE(tx.total_invested, 0) AS unrealized_pnl,
        COALESCE(sh.shareholder_name, NULL) AS shareholder_name
      FROM users u
      LEFT JOIN balances b ON b.user_id = u.id
      LEFT JOIN (
        SELECT h.user_id, SUM(h.quantity * s.current_price) AS portfolio_value
        FROM holdings h JOIN stocks s ON s.id = h.stock_id WHERE h.quantity > 0
        GROUP BY h.user_id
      ) pv ON pv.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(CASE WHEN type='buy' THEN total ELSE -total END) AS total_invested
        FROM transactions GROUP BY user_id
      ) tx ON tx.user_id = u.id
      LEFT JOIN (
        SELECT r.client_id, u2.name AS shareholder_name
        FROM relationships r JOIN users u2 ON u2.id = r.shareholder_id
      ) sh ON sh.client_id = u.id
      WHERE u.user_type IN ('client', 'shareholder')
      ORDER BY u.user_type, total_value DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Shareholder dashboard stats
router.get('/shareholder', authenticate, async (req, res) => {
  try {
    if (req.user.user_type !== 'shareholder') return res.status(403).json({ error: 'Forbidden' });

    const clientsRes = await query(`
      SELECT COUNT(*) as client_count,
             COALESCE(SUM(b.cash_balance), 0) as total_cash
      FROM relationships r
      JOIN users u ON u.id = r.client_id
      LEFT JOIN balances b ON b.user_id = u.id
      WHERE r.shareholder_id = $1
    `, [req.user.id]);

    const aum = await query(`
      SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as portfolio_value
      FROM relationships r
      JOIN holdings h ON h.user_id = r.client_id
      JOIN stocks s ON s.id = h.stock_id
      WHERE r.shareholder_id = $1
    `, [req.user.id]);

    const ownPortfolio = await query(`
      SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as value
      FROM holdings h JOIN stocks s ON s.id = h.stock_id WHERE h.user_id = $1
    `, [req.user.id]);

    const ownBalance = await query(`SELECT cash_balance FROM balances WHERE user_id = $1`, [req.user.id]);

    res.json({
      client_count: parseInt(clientsRes.rows[0].client_count),
      clients_cash_aum: parseFloat(clientsRes.rows[0].total_cash),
      clients_portfolio_aum: parseFloat(aum.rows[0].portfolio_value),
      own_portfolio_value: parseFloat(ownPortfolio.rows[0].value),
      own_cash_balance: parseFloat(ownBalance.rows[0]?.cash_balance || 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
