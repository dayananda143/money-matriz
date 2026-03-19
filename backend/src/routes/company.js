const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// Create tables if not exists
const ensureTable = query(`
  CREATE TABLE IF NOT EXISTS company_records (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() =>
  query(`ALTER TABLE company_records ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`)
).then(() =>
  query(`
    CREATE TABLE IF NOT EXISTS debt_payments (
      id SERIAL PRIMARY KEY,
      debt_id INTEGER REFERENCES company_records(id) ON DELETE CASCADE,
      amount DECIMAL(15,2) NOT NULL,
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
).then(() =>
  query(`ALTER TABLE company_records ADD COLUMN IF NOT EXISTS share_type VARCHAR(100)`)
).then(() =>
  query(`ALTER TABLE company_records ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50)`)
).then(() =>
  query(`
    CREATE TABLE IF NOT EXISTS shares_contributors (
      id SERIAL PRIMARY KEY,
      shares_id INTEGER REFERENCES company_records(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(15,2) NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
).then(() =>
  query(`ALTER TABLE shares_contributors ADD COLUMN IF NOT EXISTS scheme VARCHAR(100)`)
).then(() =>
  query(`ALTER TABLE shares_contributors ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT FALSE`)
).then(() =>
  query(`ALTER TABLE company_records ADD COLUMN IF NOT EXISTS scheme VARCHAR(100)`)
).then(() =>
  query(`ALTER TABLE company_records ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT FALSE`)
).then(() =>
  query(`ALTER TABLE company_records ADD COLUMN IF NOT EXISTS bank_value DECIMAL(15,2)`)
).then(() =>
  query(`ALTER TABLE company_records ADD COLUMN IF NOT EXISTS maturity_date DATE`)
).catch(console.error);

// GET records by category
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { category } = req.query;
    let sql = `SELECT cr.*,
               cb.name as created_by_name,
               ur.name as user_name, ur.email as user_email, ur.user_type as user_type,
               COALESCE(p.total_paid, 0) as total_paid,
               COALESCE(sc.total_contributed, 0) as total_contributed,
               COALESCE(sc.contributor_count, 0) as contributor_count,
               COALESCE(sc.contributor_user_ids, '{}') as contributor_user_ids
               FROM company_records cr
               LEFT JOIN users cb ON cb.id = cr.created_by
               LEFT JOIN users ur ON ur.id = cr.user_id
               LEFT JOIN (
                 SELECT debt_id, SUM(amount) as total_paid FROM debt_payments GROUP BY debt_id
               ) p ON p.debt_id = cr.id
               LEFT JOIN (
                 SELECT shares_id, SUM(amount) as total_contributed, COUNT(*) as contributor_count,
                        array_agg(user_id) as contributor_user_ids
                 FROM shares_contributors GROUP BY shares_id
               ) sc ON sc.shares_id = cr.id
               WHERE 1=1`;
    const params = [];
    if (category) { params.push(category); sql += ` AND cr.category = $${params.length}`; }
    sql += ' ORDER BY cr.record_date DESC, cr.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create record
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { category, description, amount, record_date, notes, user_id, share_type, transaction_type, scheme, bank_value, maturity_date } = req.body;
    if (!category || !description || amount == null) {
      return res.status(400).json({ error: 'category, description, amount required' });
    }
    const { rows } = await query(
      `INSERT INTO company_records (category, description, amount, record_date, notes, user_id, share_type, transaction_type, scheme, bank_value, maturity_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [category, description, parseFloat(amount), record_date || new Date().toISOString().slice(0,10), notes || null, user_id || null, share_type || null, transaction_type || null, scheme || null, bank_value != null ? parseFloat(bank_value) : null, maturity_date || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update record
router.put('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { description, amount, record_date, notes, user_id, share_type, transaction_type, scheme, excluded, bank_value, maturity_date } = req.body;
    const { rows } = await query(
      `UPDATE company_records SET description=$1, amount=$2, record_date=$3, notes=$4, user_id=$5, share_type=$6, transaction_type=$7, scheme=$8, excluded=$9, bank_value=$10, maturity_date=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [description, parseFloat(amount), record_date, notes || null, user_id || null, share_type || null, transaction_type || null, scheme || null, !!excluded, bank_value != null ? parseFloat(bank_value) : null, maturity_date || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE record
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM company_records WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH toggle excluded flag
router.patch('/:id/excluded', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { excluded } = req.body;
    const { rows } = await query(
      `UPDATE company_records SET excluded=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [!!excluded, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET company dashboard summary (shareholders + admins)
router.get('/dashboard', authenticate, async (req, res) => {
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  const isShareholder = req.user.user_type === 'shareholder';
  if (!isAdmin && !isShareholder) return res.status(403).json({ error: 'Forbidden' });
  try {
    const [catRows, debtRows, sharesRows, sharesSummary, sharesTypeRows, recentRows, stockPnlRows, tradingTotalRows, depositsRows] = await Promise.all([
      query(`SELECT category, COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM company_records GROUP BY category`),
      query(`SELECT COALESCE(SUM(cr.amount),0) as total_debt, COALESCE(SUM(dp.total_paid),0) as total_paid
             FROM company_records cr
             LEFT JOIN (SELECT debt_id, SUM(amount) as total_paid FROM debt_payments GROUP BY debt_id) dp ON dp.debt_id = cr.id
             WHERE cr.category = 'debt'`),
      query(`SELECT COALESCE(SUM(sc.amount),0) as total_contributed
             FROM shares_contributors sc
             JOIN company_records cr ON cr.id = sc.shares_id
             WHERE cr.category = 'shares'`),
      query(`SELECT u.id, u.name, COALESCE(SUM(sc.amount),0) as total_amount
             FROM shares_contributors sc
             JOIN company_records cr ON cr.id = sc.shares_id
             JOIN users u ON u.id = sc.user_id
             WHERE cr.category = 'shares' AND sc.excluded = FALSE
             GROUP BY u.id, u.name
             ORDER BY total_amount DESC`),
      query(`SELECT COALESCE(cr.share_type, 'Uncategorized') as share_type,
                    COALESCE(SUM(sc.amount),0) as total,
                    COUNT(DISTINCT cr.id) as count
             FROM company_records cr
             LEFT JOIN shares_contributors sc ON sc.shares_id = cr.id
             WHERE cr.category = 'shares'
             GROUP BY cr.share_type
             ORDER BY total DESC`),
      query(`SELECT cr.id, cr.category, cr.description, cr.amount, cr.record_date, cr.share_type,
                    u.name as user_name, u.user_type
             FROM company_records cr
             LEFT JOIN users u ON u.id = cr.user_id
             ORDER BY cr.created_at DESC LIMIT 10`),
      query(`SELECT
               COALESCE(SUM(CASE WHEN transaction_type = 'investment' THEN amount ELSE 0 END), 0) as total_invested,
               COALESCE(SUM(CASE WHEN transaction_type IN ('profit_return','loss_return','partial_return') THEN amount ELSE 0 END), 0) as total_returned
             FROM company_records WHERE category = 'stock_strategy'`),
      query(`SELECT COALESCE(SUM(sc.amount), 0) as total
             FROM shares_contributors sc
             JOIN company_records cr ON cr.id = sc.shares_id
             JOIN users u ON u.id = sc.user_id
             WHERE cr.category = 'trading_investment' AND LOWER(u.name) = 'moneymatriz'`),
      query(`SELECT
               COALESCE(SUM(amount), 0) as total_principal,
               COALESCE(SUM(COALESCE(bank_value, amount)), 0) as total_bank_value,
               COUNT(*) as count
             FROM company_records WHERE category = 'deposits'`),
    ]);
    const catMap = {};
    catRows.rows.forEach(r => { catMap[r.category] = { total: parseFloat(r.total), count: parseInt(r.count) }; });
    const debt = debtRows.rows[0];
    res.json({
      categories: catMap,
      debt: {
        total: parseFloat(debt.total_debt),
        paid: parseFloat(debt.total_paid),
        remaining: parseFloat(debt.total_debt) - parseFloat(debt.total_paid),
      },
      shares: {
        total_contributed: parseFloat(sharesRows.rows[0].total_contributed),
        breakdown: sharesSummary.rows.map(r => ({ ...r, total_amount: parseFloat(r.total_amount) })),
        by_type: sharesTypeRows.rows.map(r => ({ share_type: r.share_type, total: parseFloat(r.total), count: parseInt(r.count) })),
      },
      recent: recentRows.rows,
      stock_strategy_pnl: {
        invested: parseFloat(stockPnlRows.rows[0].total_invested),
        returned: parseFloat(stockPnlRows.rows[0].total_returned),
        net: parseFloat(stockPnlRows.rows[0].total_returned) - parseFloat(stockPnlRows.rows[0].total_invested),
      },
      trading_investment_total: parseFloat(tradingTotalRows.rows[0].total),
      deposits: {
        principal: parseFloat(depositsRows.rows[0].total_principal),
        bank_value: parseFloat(depositsRows.rows[0].total_bank_value),
        interest: parseFloat(depositsRows.rows[0].total_bank_value) - parseFloat(depositsRows.rows[0].total_principal),
        count: parseInt(depositsRows.rows[0].count),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET contributions for a specific user (optionally filtered by category)
router.get('/contributors/by-user/:userId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const category = req.query.category || 'trading_investment';
    const { rows } = await query(
      `SELECT sc.id as contributor_id, sc.amount, sc.notes, sc.excluded,
              cr.id, cr.description, cr.record_date, cr.notes as record_notes, cr.share_type
       FROM shares_contributors sc
       JOIN company_records cr ON cr.id = sc.shares_id
       WHERE sc.user_id = $1 AND cr.category = $2
       ORDER BY cr.record_date DESC`,
      [req.params.userId, category]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET aggregated shares summary per shareholder
router.get('/shares-summary', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, COALESCE(SUM(sc.amount), 0) as total_amount
       FROM shares_contributors sc
       JOIN company_records cr ON cr.id = sc.shares_id
       JOIN users u ON u.id = sc.user_id
       WHERE cr.category = 'shares' AND sc.excluded = FALSE
       GROUP BY u.id, u.name, u.email
       ORDER BY total_amount DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET payments for a debt record
router.get('/:id/payments', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT dp.*, u.name as created_by_name
       FROM debt_payments dp
       LEFT JOIN users u ON u.id = dp.created_by
       WHERE dp.debt_id = $1
       ORDER BY dp.payment_date DESC, dp.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST add payment to a debt record
router.post('/:id/payments', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { amount, payment_date, notes } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });
    const { rows } = await query(
      `INSERT INTO debt_payments (debt_id, amount, payment_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, parseFloat(amount), payment_date || new Date().toISOString().slice(0,10), notes || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a payment
router.delete('/:id/payments/:paymentId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM debt_payments WHERE id = $1 AND debt_id = $2', [req.params.paymentId, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET contributors for a shares record
router.get('/:id/contributors', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT sc.*, u.name as user_name, u.email as user_email, u.user_type,
              cb.name as created_by_name
       FROM shares_contributors sc
       LEFT JOIN users u ON u.id = sc.user_id
       LEFT JOIN users cb ON cb.id = sc.created_by
       WHERE sc.shares_id = $1
       ORDER BY sc.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST add contributor to a shares record
router.post('/:id/contributors', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { user_id, amount, notes, scheme } = req.body;
    if (!user_id || amount == null) return res.status(400).json({ error: 'user_id and amount required' });
    const { rows } = await query(
      `INSERT INTO shares_contributors (shares_id, user_id, amount, notes, scheme, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, user_id, parseFloat(amount), notes || null, scheme || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update a contributor
router.put('/:id/contributors/:contributorId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { amount, notes, scheme } = req.body;
    if (amount == null) return res.status(400).json({ error: 'amount required' });
    const { rows } = await query(
      `UPDATE shares_contributors SET amount=$1, notes=$2, scheme=$3 WHERE id=$4 AND shares_id=$5 RETURNING *`,
      [parseFloat(amount), notes || null, scheme || null, req.params.contributorId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Contributor not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH toggle contributor excluded
router.patch('/:id/contributors/:contributorId/excluded', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE shares_contributors SET excluded = NOT excluded WHERE id=$1 AND shares_id=$2 RETURNING *`,
      [req.params.contributorId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Contributor not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a contributor
router.delete('/:id/contributors/:contributorId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM shares_contributors WHERE id = $1 AND shares_id = $2', [req.params.contributorId, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
