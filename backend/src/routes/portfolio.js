const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// Helper: can user view target's data?
async function canAccess(viewer, targetId) {
  if (viewer.role === 'super_admin' || viewer.role === 'admin') return true;
  if (viewer.id === parseInt(targetId)) return true;
  // Any shareholder can view any client
  if (viewer.user_type === 'shareholder') return true;
  return false;
}

// GET portfolio summary for a user (or 'me')
router.get('/:userId/summary', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (!await canAccess(req.user, userId)) return res.status(403).json({ error: 'Forbidden' });

    const [holdingsRes, balanceRes, txRes, sipRes, fundRes] = await Promise.all([
      query(`
        SELECT h.id, h.quantity, h.avg_buy_price,
               s.id as stock_id, s.symbol, s.name as stock_name, s.current_price, s.previous_close, s.sector, s.market_cap_category,
               (h.quantity * s.current_price) as current_value,
               (h.quantity * s.current_price - h.quantity * h.avg_buy_price) as unrealized_pnl,
               CASE WHEN h.avg_buy_price > 0
                    THEN ((s.current_price - h.avg_buy_price) / h.avg_buy_price * 100)
                    ELSE 0 END as pnl_percent,
               CASE WHEN ROUND(h.quantity::numeric, 2) > 0 THEN 'active' ELSE 'exited' END as status,
               COALESCE((
                 SELECT SUM(t.quantity) FROM transactions t
                 WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id AND t.type = 'buy'
               ), h.quantity) as total_bought_quantity,
               COALESCE((
                 SELECT ROUND(SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE -t.total END)::numeric, 2)
                 FROM transactions t WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id
               ), 0) as realized_pnl,
               COALESCE((
                 SELECT ROUND(SUM(t.total)::numeric, 2) FROM transactions t
                 WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id AND t.type = 'buy'
               ), 0) as total_buy_amount,
               (SELECT MIN(t.executed_at) FROM transactions t
                WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id AND t.type = 'buy') as first_buy_date,
               (SELECT MAX(t.executed_at) FROM transactions t
                WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id AND t.type = 'sell') as last_sell_date,
               COALESCE((
                 SELECT SUM(COALESCE(t.brokerage, 0)) FROM transactions t
                 WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id AND t.type = 'sell'
               ), 0) as total_sell_brokerage,
               COALESCE((
                 SELECT ROUND(SUM(t.total)::numeric, 2) FROM transactions t
                 WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id AND t.type = 'sell'
               ), 0) as total_sell_amount,
               COALESCE((
                 SELECT CASE WHEN SUM(t.quantity) > 0
                   THEN ROUND(SUM(t.total)::numeric / SUM(t.quantity)::numeric, 2)
                   ELSE 0 END
                 FROM transactions t
                 WHERE t.user_id = h.user_id AND t.stock_id = h.stock_id AND t.type = 'sell'
               ), 0) as avg_sell_price
        FROM holdings h
        JOIN stocks s ON s.id = h.stock_id
        WHERE h.user_id = $1
        ORDER BY h.quantity DESC, current_value DESC
      `, [userId]),
      query('SELECT user_type FROM users WHERE id = $1', [userId]),
      query(`
        SELECT COALESCE(SUM(CASE WHEN type = 'buy' THEN total ELSE -total END), 0) as invested
        FROM transactions WHERE user_id = $1
      `, [userId]),
      query(`
        SELECT COALESCE(SUM(CASE WHEN sip_type = 'withdraw' THEN -amount ELSE amount END), 0) as sip_net_invested
        FROM sip_plans WHERE shareholder_id = $1
      `, [userId]),
      query(`
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as net_deposited
        FROM fund_movements WHERE user_id = $1
      `, [userId])
    ]);

    const holdings = holdingsRes.rows;
    const userType = balanceRes.rows[0]?.user_type;
    const portfolioValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value), 0);
    const invested = parseFloat(txRes.rows[0]?.invested || 0);
    const sipNetInvested = parseFloat(sipRes.rows[0]?.sip_net_invested || 0);
    const netDeposited = parseFloat(fundRes.rows[0]?.net_deposited || 0);
    const activeInvested = holdings
      .filter(h => parseFloat(h.quantity) > 0)
      .reduce((sum, h) => sum + parseFloat(h.quantity) * parseFloat(h.avg_buy_price), 0);
    const cashBalance = userType === 'shareholder'
      ? sipNetInvested - activeInvested
      : netDeposited - activeInvested;
    const totalValue = portfolioValue + cashBalance;

    res.json({
      holdings,
      cash_balance: cashBalance,
      portfolio_value: portfolioValue,
      total_value: totalValue,
      invested,
      total_pnl: portfolioValue - invested,
      sip_net_invested: sipNetInvested,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all transactions (admin/super_admin)
router.get('/all/transactions', authenticate, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    const { limit = 200, offset = 0, type } = req.query;
    let sql = `
      SELECT t.*, s.symbol, s.name as stock_name,
             u.name as user_name, u.user_type,
             cb.name as executed_by_name
      FROM transactions t
      JOIN stocks s ON s.id = t.stock_id
      JOIN users u ON u.id = t.user_id
      LEFT JOIN users cb ON cb.id = t.created_by
    `;
    const params = [];
    if (type) { params.push(type); sql += ` WHERE t.type = $${params.length}`; }
    sql += ` ORDER BY t.executed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET transactions for a user
router.get('/:userId/transactions', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (!await canAccess(req.user, userId)) return res.status(403).json({ error: 'Forbidden' });

    const { limit = 50, offset = 0, type, stock_id } = req.query;
    let sql = `
      SELECT t.*, s.symbol, s.name as stock_name,
             u.name as executed_by_name
      FROM transactions t
      JOIN stocks s ON s.id = t.stock_id
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.user_id = $1
    `;
    const params = [userId];
    if (type) { params.push(type); sql += ` AND t.type = $${params.length}`; }
    if (stock_id) { params.push(stock_id); sql += ` AND t.stock_id = $${params.length}`; }
    sql += ` ORDER BY t.executed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET fund movements for a user
router.get('/:userId/funds', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (!await canAccess(req.user, userId)) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await query(`
      SELECT f.*, u.name as executed_by_name
      FROM fund_movements f
      LEFT JOIN users u ON u.id = f.created_by
      WHERE f.user_id = $1
      ORDER BY f.executed_at DESC
    `, [userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST execute a trade (admin/super_admin can trade for any user)
router.post('/:userId/trade', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (!await canAccess(req.user, userId)) return res.status(403).json({ error: 'Forbidden' });
    // Only admins/shareholders can trade for others
    if (parseInt(userId) !== req.user.id && req.user.role === 'user' && req.user.user_type !== 'shareholder') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { stock_id, type, quantity, price, notes, executed_at, group_id } = req.body;
    if (!stock_id || !type || !quantity || !price) {
      return res.status(400).json({ error: 'stock_id, type, quantity, price required' });
    }
    // Use provided total if given (preserves exact invested amount), otherwise compute
    const total = req.body.total != null ? parseFloat(req.body.total) : parseFloat(quantity) * parseFloat(price);

    // Get stock
    const stockRes = await query('SELECT * FROM stocks WHERE id = $1', [stock_id]);
    if (!stockRes.rows[0]) return res.status(404).json({ error: 'Stock not found' });

    // Get or create balance
    await query('INSERT INTO balances (user_id, cash_balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [userId]);
    const balRes = await query('SELECT cash_balance FROM balances WHERE user_id = $1', [userId]);
    const cash = parseFloat(balRes.rows[0].cash_balance);

    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (type === 'buy' && !isAdmin && cash < total) {
      return res.status(400).json({ error: `Insufficient balance. Available: ${cash.toFixed(2)}` });
    }

    // Check holdings for sell
    if (type === 'sell') {
      const hRes = await query('SELECT quantity FROM holdings WHERE user_id = $1 AND stock_id = $2', [userId, stock_id]);
      const held = parseFloat(hRes.rows[0]?.quantity || 0);
      if (held < parseFloat(quantity)) {
        return res.status(400).json({ error: `Insufficient shares. Available: ${held}` });
      }
    }

    // Insert transaction
    const txExecAt = executed_at || new Date().toISOString();
    const brokerage = type === 'sell' ? parseFloat(req.body.brokerage || 0) : 0;
    const txGroupId = group_id ? parseInt(group_id) : null;
    const { rows: txRows } = await query(
      `INSERT INTO transactions (user_id, stock_id, type, quantity, price, total, notes, executed_at, created_by, brokerage, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [userId, stock_id, type, quantity, price, total, notes || null, txExecAt, req.user.id, brokerage, txGroupId]
    );

    // Update holdings
    if (type === 'buy') {
      await query(`
        INSERT INTO holdings (user_id, stock_id, quantity, avg_buy_price)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, stock_id) DO UPDATE SET
          avg_buy_price = (holdings.avg_buy_price * holdings.quantity + $4 * $3) / (holdings.quantity + $3),
          quantity = holdings.quantity + $3,
          updated_at = NOW()
      `, [userId, stock_id, quantity, price]);
      await query('UPDATE balances SET cash_balance = cash_balance - $1, updated_at = NOW() WHERE user_id = $2', [total, userId]);
    } else {
      await query(`
        UPDATE holdings SET quantity = quantity - $1, updated_at = NOW()
        WHERE user_id = $2 AND stock_id = $3
      `, [quantity, userId, stock_id]);
      await query('UPDATE balances SET cash_balance = cash_balance + $1, updated_at = NOW() WHERE user_id = $2', [total, userId]);

      // If all holders of this stock have exited (quantity = 0), mark stock as inactive
      const remainingRes = await query(
        'SELECT COUNT(*) FROM holdings WHERE stock_id = $1 AND ROUND(quantity::numeric, 2) > 0',
        [stock_id]
      );
      if (parseInt(remainingRes.rows[0].count) === 0) {
        await query('UPDATE stocks SET is_active = false, last_updated = NOW() WHERE id = $1', [stock_id]);
      }
    }

    res.status(201).json(txRows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT directly update a holding (admin only — for corrections)
router.put('/:userId/holding/:stockId', authenticate, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    const { quantity, avg_buy_price, buy_date, brokerage } = req.body;
    if (quantity === undefined || avg_buy_price === undefined) {
      return res.status(400).json({ error: 'quantity and avg_buy_price required' });
    }
    const { rows } = await query(`
      INSERT INTO holdings (user_id, stock_id, quantity, avg_buy_price, brokerage)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, stock_id) DO UPDATE SET
        quantity = $3, avg_buy_price = $4, brokerage = $5, updated_at = NOW()
      RETURNING *
    `, [req.params.userId, req.params.stockId, quantity, avg_buy_price, brokerage ?? 0]);
    if (buy_date) {
      const updateRes = await query(`
        UPDATE transactions SET executed_at = $1
        WHERE id = (
          SELECT id FROM transactions
          WHERE user_id = $2 AND stock_id = $3 AND type = 'buy'
          ORDER BY executed_at ASC LIMIT 1
        )
      `, [buy_date, req.params.userId, req.params.stockId]);
      // No buy transaction exists yet — create one so first_buy_date is populated
      if (updateRes.rowCount === 0) {
        const total = parseFloat(quantity) * parseFloat(avg_buy_price);
        await query(
          `INSERT INTO transactions (user_id, stock_id, type, quantity, price, total, executed_at, created_by)
           VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7)`,
          [req.params.userId, req.params.stockId, quantity, avg_buy_price, total, buy_date, req.user.id]
        );
      }
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a holding (admin only)
router.delete('/:userId/holding/:stockId', authenticate, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM holdings WHERE user_id = $1 AND stock_id = $2', [req.params.userId, req.params.stockId]);
    res.json({ message: 'Holding removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST fund movement (deposit/withdrawal) — admin only
router.post('/:userId/funds', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (parseInt(userId) !== req.user.id) {
      if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    }

    const { type, amount, notes, executed_at } = req.body;
    if (!type || !amount) return res.status(400).json({ error: 'type and amount required' });

    await query('INSERT INTO balances (user_id, cash_balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [userId]);

    if (type === 'withdrawal') {
      const { rows } = await query('SELECT cash_balance FROM balances WHERE user_id = $1', [userId]);
      if (parseFloat(rows[0].cash_balance) < parseFloat(amount)) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
    }

    const txExecAt = executed_at || new Date().toISOString();
    const { rows } = await query(
      `INSERT INTO fund_movements (user_id, type, amount, notes, executed_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, type, amount, notes || null, txExecAt, req.user.id]
    );

    const delta = type === 'deposit' ? parseFloat(amount) : -parseFloat(amount);
    await query('UPDATE balances SET cash_balance = cash_balance + $1, updated_at = NOW() WHERE user_id = $2', [delta, userId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT edit a fund movement
router.put('/:userId/funds/:fundId', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (parseInt(userId) !== req.user.id) {
      if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    }
    const { type, amount, notes, executed_at } = req.body;
    // Get old record to reverse balance
    const { rows: [old] } = await query('SELECT * FROM fund_movements WHERE id = $1 AND user_id = $2', [req.params.fundId, userId]);
    if (!old) return res.status(404).json({ error: 'Fund movement not found' });

    const oldDelta = old.type === 'deposit' ? -parseFloat(old.amount) : parseFloat(old.amount);
    const newDelta = (type || old.type) === 'deposit' ? parseFloat(amount || old.amount) : -parseFloat(amount || old.amount);

    const { rows } = await query(
      `UPDATE fund_movements SET type = COALESCE($1, type), amount = COALESCE($2::numeric, amount),
       notes = COALESCE($3, notes), executed_at = COALESCE($4::timestamptz, executed_at)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [type || null, amount || null, notes ?? null, executed_at || null, req.params.fundId, userId]
    );
    await query('UPDATE balances SET cash_balance = cash_balance + $1 + $2, updated_at = NOW() WHERE user_id = $3', [oldDelta, newDelta, userId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a fund movement
router.delete('/:userId/funds/:fundId', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (parseInt(userId) !== req.user.id) {
      if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows: [fund] } = await query('SELECT * FROM fund_movements WHERE id = $1 AND user_id = $2', [req.params.fundId, userId]);
    if (!fund) return res.status(404).json({ error: 'Fund movement not found' });

    await query('DELETE FROM fund_movements WHERE id = $1', [req.params.fundId]);
    const delta = fund.type === 'deposit' ? -parseFloat(fund.amount) : parseFloat(fund.amount);
    await query('UPDATE balances SET cash_balance = cash_balance + $1, updated_at = NOW() WHERE user_id = $2', [delta, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
