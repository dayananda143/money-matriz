const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// Helper: can user view target's data?
async function canAccess(viewer, targetId) {
  if (viewer.role === 'super_admin' || viewer.role === 'admin') return true;
  if (viewer.id === parseInt(targetId)) return true;
  // Shareholder can view their clients
  if (viewer.user_type === 'shareholder') {
    const { rows } = await query(
      'SELECT id FROM relationships WHERE shareholder_id = $1 AND client_id = $2',
      [viewer.id, targetId]
    );
    return rows.length > 0;
  }
  return false;
}

// GET portfolio summary for a user (or 'me')
router.get('/:userId/summary', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    if (!await canAccess(req.user, userId)) return res.status(403).json({ error: 'Forbidden' });

    const [holdingsRes, balanceRes, txRes] = await Promise.all([
      query(`
        SELECT h.id, h.quantity, h.avg_buy_price,
               s.id as stock_id, s.symbol, s.name as stock_name, s.current_price, s.previous_close, s.sector,
               (h.quantity * s.current_price) as current_value,
               (h.quantity * s.current_price - h.quantity * h.avg_buy_price) as unrealized_pnl,
               CASE WHEN h.avg_buy_price > 0
                    THEN ((s.current_price - h.avg_buy_price) / h.avg_buy_price * 100)
                    ELSE 0 END as pnl_percent,
               CASE WHEN h.quantity > 0 THEN 'active' ELSE 'exited' END as status,
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
               ), 0) as total_buy_amount
        FROM holdings h
        JOIN stocks s ON s.id = h.stock_id
        WHERE h.user_id = $1
        ORDER BY h.quantity DESC, current_value DESC
      `, [userId]),
      query('SELECT cash_balance FROM balances WHERE user_id = $1', [userId]),
      query(`
        SELECT COALESCE(SUM(CASE WHEN type = 'buy' THEN total ELSE -total END), 0) as invested
        FROM transactions WHERE user_id = $1
      `, [userId])
    ]);

    const holdings = holdingsRes.rows;
    const cash = balanceRes.rows[0]?.cash_balance || 0;
    const portfolioValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value), 0);
    const invested = parseFloat(txRes.rows[0]?.invested || 0);
    const totalValue = portfolioValue + parseFloat(cash);

    res.json({
      holdings,
      cash_balance: parseFloat(cash),
      portfolio_value: portfolioValue,
      total_value: totalValue,
      invested,
      total_pnl: portfolioValue - invested,
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

    const { stock_id, type, quantity, price, notes, executed_at } = req.body;
    if (!stock_id || !type || !quantity || !price) {
      return res.status(400).json({ error: 'stock_id, type, quantity, price required' });
    }
    const total = parseFloat(quantity) * parseFloat(price);

    // Get stock
    const stockRes = await query('SELECT * FROM stocks WHERE id = $1 AND is_active = true', [stock_id]);
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
    const { rows: txRows } = await query(
      `INSERT INTO transactions (user_id, stock_id, type, quantity, price, total, notes, executed_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, stock_id, type, quantity, price, total, notes || null, txExecAt, req.user.id]
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
    const { quantity, avg_buy_price } = req.body;
    if (quantity === undefined || avg_buy_price === undefined) {
      return res.status(400).json({ error: 'quantity and avg_buy_price required' });
    }
    const { rows } = await query(`
      INSERT INTO holdings (user_id, stock_id, quantity, avg_buy_price)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, stock_id) DO UPDATE SET
        quantity = $3, avg_buy_price = $4, updated_at = NOW()
      RETURNING *
    `, [req.params.userId, req.params.stockId, quantity, avg_buy_price]);
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

module.exports = router;
