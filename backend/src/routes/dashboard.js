const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// Super admin / admin overview
router.get('/overview', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const [usersRes, stocksRes, aumRes, txRes] = await Promise.all([
      query(`SELECT user_type, COUNT(*) as count FROM users WHERE is_active = true GROUP BY user_type`),
      query(`SELECT COUNT(DISTINCT stock_id) as count FROM holdings WHERE quantity > 0`),
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
        COALESCE(pv.portfolio_value, 0) AS portfolio_value,
        COALESCE(ai.active_invested, 0) AS total_invested,
        COALESCE(pv.portfolio_value, 0) - COALESCE(ai.active_invested, 0) AS unrealized_pnl,
        CASE
          WHEN u.user_type = 'shareholder' THEN
            COALESCE(sip.sip_net, 0) - COALESCE(nd.net_deployed, 0)
          ELSE
            COALESCE(fm.net_deposited, 0) - COALESCE(ai.active_invested, 0) + COALESCE(rpnl.realized_pnl, 0)
        END AS cash_balance,
        COALESCE(pv.portfolio_value, 0) + (
          CASE
            WHEN u.user_type = 'shareholder' THEN
              COALESCE(sip.sip_net, 0) - COALESCE(nd.net_deployed, 0)
            ELSE
              COALESCE(fm.net_deposited, 0) - COALESCE(ai.active_invested, 0) + COALESCE(rpnl.realized_pnl, 0)
          END
        ) AS total_value,
        COALESCE(rpnl.realized_pnl, 0) AS realized_pnl,
        COALESCE(shrpnl.sh_realized_pnl, 0) AS sh_realized_pnl,
        COALESCE(sh.shareholder_name, NULL) AS shareholder_name
      FROM users u
      LEFT JOIN (
        SELECT h.user_id, SUM(h.quantity * s.current_price) AS portfolio_value
        FROM holdings h JOIN stocks s ON s.id = h.stock_id WHERE h.quantity > 0
        GROUP BY h.user_id
      ) pv ON pv.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(quantity * avg_buy_price) AS active_invested
        FROM holdings WHERE quantity > 0
        GROUP BY user_id
      ) ai ON ai.user_id = u.id
      LEFT JOIN (
        SELECT shareholder_id, SUM(CASE WHEN sip_type != 'withdraw' THEN amount ELSE -amount END) AS sip_net
        FROM sip_plans GROUP BY shareholder_id
      ) sip ON sip.shareholder_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(CASE WHEN type = 'buy' THEN total ELSE -total END) AS net_deployed
        FROM transactions GROUP BY user_id
      ) nd ON nd.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END) AS net_deposited
        FROM fund_movements GROUP BY user_id
      ) fm ON fm.user_id = u.id
      LEFT JOIN (
        SELECT t.user_id,
          SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE -t.total END) AS realized_pnl
        FROM transactions t
        JOIN holdings h ON h.user_id = t.user_id AND h.stock_id = t.stock_id
        WHERE h.quantity <= 0
        GROUP BY t.user_id
      ) rpnl ON rpnl.user_id = u.id
      LEFT JOIN (
        SELECT t.user_id,
          SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE -t.total END) AS sh_realized_pnl
        FROM transactions t
        JOIN stock_groups g ON g.id = t.group_id
        WHERE g.stock_id IN (
          SELECT g2.stock_id FROM stock_groups g2
          LEFT JOIN transactions t2 ON t2.group_id = g2.id
          GROUP BY g2.stock_id, g2.holder_id
          HAVING SUM(CASE WHEN t2.type = 'buy' THEN t2.quantity ELSE -t2.quantity END) <= 0
        )
        GROUP BY t.user_id
      ) shrpnl ON shrpnl.user_id = u.id
      LEFT JOIN (
        SELECT r.client_id, u2.name AS shareholder_name
        FROM relationships r JOIN users u2 ON u2.id = r.shareholder_id
      ) sh ON sh.client_id = u.id
      WHERE u.user_type IN ('client', 'shareholder')
      ORDER BY u.user_type, portfolio_value DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// All active holdings across all users (admin/super_admin)
router.get('/all-holdings', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        s.symbol,
        s.name                                         AS stock_name,
        s.sector,
        s.market_cap_category,
        s.current_price,
        SUM(h.quantity)                                AS quantity,
        CASE WHEN SUM(h.quantity) > 0
             THEN ROUND((SUM(h.quantity * h.avg_buy_price) / SUM(h.quantity))::numeric, 2)
             ELSE 0 END                                AS avg_buy_price,
        SUM(h.quantity * s.current_price)              AS current_value,
        SUM(h.quantity * s.current_price)
          - SUM(h.quantity * h.avg_buy_price)          AS unrealized_pnl
      FROM holdings h
      JOIN stocks s ON s.id = h.stock_id
      WHERE h.quantity > 0
      GROUP BY s.id, s.symbol, s.name, s.sector, s.market_cap_category, s.current_price
      ORDER BY current_value DESC
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

    const sipRes = await query(`
      SELECT COALESCE(SUM(CASE WHEN sip_type != 'withdraw' THEN amount ELSE -amount END), 0) AS net_invested
      FROM sip_plans WHERE shareholder_id = $1
    `, [req.user.id]);

    res.json({
      client_count: parseInt(clientsRes.rows[0].client_count),
      clients_cash_aum: parseFloat(clientsRes.rows[0].total_cash),
      clients_portfolio_aum: parseFloat(aum.rows[0].portfolio_value),
      own_portfolio_value: parseFloat(ownPortfolio.rows[0].value),
      own_cash_balance: parseFloat(ownBalance.rows[0]?.cash_balance || 0),
      sip_net_invested: parseFloat(sipRes.rows[0].net_invested),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
