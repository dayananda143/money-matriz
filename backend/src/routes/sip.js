const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

function addFrequency(date, frequency) {
  const d = new Date(date);
  switch (frequency) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

function canManage(user) {
  return user.role === 'admin' || user.role === 'super_admin' || user.user_type === 'shareholder';
}

async function shareholderOwnsClient(shareholderId, clientId) {
  const { rows } = await query(
    'SELECT 1 FROM relationships WHERE shareholder_id = $1 AND client_id = $2',
    [shareholderId, clientId]
  );
  return rows.length > 0;
}

const BASE_SELECT = `
  SELECT sp.*,
    sh.id AS shareholder_id, sh.name AS shareholder_name, sh.email AS shareholder_email,
    s.symbol AS stock_symbol, s.name AS stock_name, s.sector AS stock_sector, s.current_price
  FROM sip_plans sp
  JOIN users sh ON sh.id = sp.shareholder_id
  LEFT JOIN stocks s ON s.id = sp.stock_id
`;

// ── Participants (must be before /:id routes) ──────────────────────────────

// GET participants (shareholders enrolled in SIP + their plan stats)
// Includes any shareholder who either is in sip_participants OR has SIP plans
router.get('/participants', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.user_type, u.is_active,
        p.default_amount,
        COUNT(sp.id)::int AS total_plans,
        COALESCE(SUM(sp.amount), 0) AS total_invested,
        COALESCE(SUM(sp.amount) FILTER (WHERE sp.sip_type = 'sip'), 0) AS sip_amount,
        COALESCE(SUM(sp.amount) FILTER (WHERE sp.sip_type = 'additional'), 0) AS additional_amount,
        COALESCE(SUM(sp.amount) FILTER (WHERE sp.sip_type = 'withdraw'), 0) AS withdraw_amount,
        COALESCE(SUM(CASE WHEN sp.sip_type = 'withdraw' THEN -sp.amount ELSE sp.amount END), 0) AS net_total,
        COALESCE(SUM(CASE WHEN sp.sip_type = 'withdraw' THEN -sp.amount ELSE sp.amount END), 0)
          - COALESCE((SELECT SUM(h.quantity * h.avg_buy_price) FROM holdings h WHERE h.user_id = u.id AND h.quantity > 0), 0)
          AS cash_on_hand
      FROM users u
      LEFT JOIN sip_participants p ON p.shareholder_id = u.id
      LEFT JOIN sip_plans sp ON sp.shareholder_id = u.id
      WHERE (p.shareholder_id IS NOT NULL OR sp.shareholder_id IS NOT NULL)
        AND u.user_type = 'shareholder'
      GROUP BY u.id, u.name, u.email, u.user_type, u.is_active, p.default_amount
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update default_amount for a participant
router.patch('/participants/:shareholderId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { default_amount } = req.body;
    await query(
      'UPDATE sip_participants SET default_amount = $1 WHERE shareholder_id = $2',
      [default_amount || null, req.params.shareholderId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST add a participant
router.post('/participants', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { shareholder_id } = req.body;
    if (!shareholder_id) return res.status(400).json({ error: 'shareholder_id required' });
    await query(
      'INSERT INTO sip_participants (shareholder_id) VALUES ($1) ON CONFLICT (shareholder_id) DO NOTHING',
      [shareholder_id]
    );
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE remove a participant
router.delete('/participants/:shareholderId', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM sip_participants WHERE shareholder_id = $1', [req.params.shareholderId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SIP Plans ──────────────────────────────────────────────────────────────

// GET cash on hand for a shareholder — matches Portfolio page formula
router.get('/cash/:shareholderId', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { shareholderId } = req.params;
    const [sipRes, holdingsRes] = await Promise.all([
      query(`
        SELECT COALESCE(SUM(CASE WHEN sip_type = 'withdraw' THEN -amount ELSE amount END), 0) AS sip_net
        FROM sip_plans WHERE shareholder_id = $1
      `, [shareholderId]),
      query(`
        SELECT COALESCE(SUM(h.quantity * h.avg_buy_price), 0) AS active_invested
        FROM holdings h WHERE h.user_id = $1 AND h.quantity > 0
      `, [shareholderId]),
    ]);
    const sipNet       = parseFloat(sipRes.rows[0].sip_net || 0);
    const activeInvested = parseFloat(holdingsRes.rows[0].active_invested || 0);
    res.json({ cash_on_hand: parseFloat((sipNet - activeInvested).toFixed(2)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all SIP plans
router.get('/', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    let sql = BASE_SELECT;
    const params = [];
    if (!isAdmin) {
      sql += ` WHERE sp.shareholder_id = $1`;
      params.push(req.user.id);
    }
    sql += ' ORDER BY sp.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create SIP plan
router.post('/', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { shareholder_id, stock_id, amount, frequency, start_date, notes, sip_type } = req.body;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const shId = isAdmin ? shareholder_id : req.user.id;
    if (!shId || !amount)
      return res.status(400).json({ error: 'shareholder_id and amount are required' });

    const stockId = stock_id || null;
    const startDate = start_date || null;
    const { rows: [row] } = await query(
      `INSERT INTO sip_plans (shareholder_id, stock_id, amount, start_date, total_invested, notes, sip_type, created_by)
       VALUES ($1,$2,$3,$4,$3,$5,$6,$7) RETURNING id`,
      [shId, stockId, amount, startDate, notes || null, sip_type || null, req.user.id]
    );
    const { rows: [plan] } = await query(BASE_SELECT + ' WHERE sp.id = $1', [row.id]);
    res.status(201).json(plan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update SIP plan
router.put('/:id', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin) {
      const { rows: [existing] } = await query('SELECT shareholder_id FROM sip_plans WHERE id = $1', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'SIP plan not found' });
      if (existing.shareholder_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

    const { status, amount, notes, next_date, frequency, stock_id, start_date, sip_type } = req.body;
    const stockId = stock_id === '' ? null : (stock_id ?? undefined);
    const { rows: [row] } = await query(
      `UPDATE sip_plans SET
        status     = COALESCE($1, status),
        amount     = COALESCE($2::numeric, amount),
        notes      = COALESCE($3, notes),
        next_date  = COALESCE($4::date, next_date),
        frequency  = COALESCE($5, frequency),
        stock_id   = CASE WHEN $6::boolean THEN $7::integer ELSE stock_id END,
        start_date = COALESCE($8::date, start_date),
        sip_type   = CASE WHEN $10::boolean THEN $11 ELSE sip_type END,
        updated_at = NOW()
       WHERE id = $9
       RETURNING id`,
      [status ?? null, amount ?? null, notes ?? null, next_date ?? null, frequency ?? null,
       stock_id !== undefined, stockId ?? null, start_date ?? null, req.params.id,
       sip_type !== undefined, sip_type || null]
    );
    if (!row) return res.status(404).json({ error: 'SIP plan not found' });
    const { rows: [plan] } = await query(BASE_SELECT + ' WHERE sp.id = $1', [row.id]);
    res.json(plan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE SIP plan
router.delete('/:id', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin) {
      const { rows: [existing] } = await query('SELECT shareholder_id FROM sip_plans WHERE id = $1', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'SIP plan not found' });
      if (existing.shareholder_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await query('DELETE FROM sip_plans WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'SIP plan not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET installments for a plan
router.get('/:id/installments', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows } = await query(
      `SELECT i.*, u.name AS created_by_name
       FROM sip_installments i
       LEFT JOIN users u ON u.id = i.created_by
       WHERE i.sip_plan_id = $1
       ORDER BY i.invested_date DESC, i.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST record an installment
router.post('/:id/installment', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows: [existing] } = await query('SELECT * FROM sip_plans WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'SIP plan not found' });
    if (existing.status !== 'active') return res.status(400).json({ error: 'SIP plan is not active' });

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin && existing.shareholder_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { amount, invested_date, notes } = req.body;
    const installmentAmount = parseFloat(amount) || parseFloat(existing.amount);
    const date = invested_date || new Date().toISOString().split('T')[0];

    // Record individual installment
    await query(
      `INSERT INTO sip_installments (sip_plan_id, amount, invested_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, installmentAmount, date, notes || null, req.user.id]
    );

    const next_date = existing.frequency
      ? addFrequency(existing.next_date || existing.start_date, existing.frequency)
      : null;
    const { rows: [row] } = await query(
      `UPDATE sip_plans SET
        installments_completed = installments_completed + 1,
        total_invested = total_invested + $1,
        next_date = $2,
        updated_at = NOW()
       WHERE id = $3 RETURNING id`,
      [installmentAmount, next_date, req.params.id]
    );
    const { rows: [plan] } = await query(BASE_SELECT + ' WHERE sp.id = $1', [row.id]);
    res.json(plan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE an installment
router.delete('/:id/installments/:instId', authenticate, async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows: [inst] } = await query(
      'SELECT * FROM sip_installments WHERE id = $1 AND sip_plan_id = $2',
      [req.params.instId, req.params.id]
    );
    if (!inst) return res.status(404).json({ error: 'Installment not found' });

    await query('DELETE FROM sip_installments WHERE id = $1', [req.params.instId]);
    // Revert plan totals
    await query(
      `UPDATE sip_plans SET
        installments_completed = GREATEST(installments_completed - 1, 0),
        total_invested = GREATEST(total_invested - $1, 0),
        updated_at = NOW()
       WHERE id = $2`,
      [inst.amount, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
