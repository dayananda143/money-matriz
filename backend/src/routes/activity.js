const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// Friendly names for the tables the log reports on.
const TABLE_LABEL = {
  transactions: 'Transaction', holdings: 'Holding', stocks: 'Stock',
  stock_groups: 'Transaction group', brokerage_transactions: 'Brokerage',
  users: 'User', balances: 'Balance', stock_alerts: 'Price alert',
  sip_plans: 'SIP plan', sip_installments: 'SIP instalment',
  trade_requests: 'Trade request', relationships: 'Relationship',
  fund_movements: 'Fund movement',
};

// GET /api/activity — most recent first, with filters
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { actor_id, table, source, record_id, from, to, q } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    const add = (sql, value) => { params.push(value); where.push(sql.replace('$?', '$' + params.length)); };

    if (actor_id) add('actor_id = $?', parseInt(actor_id, 10));
    if (table) add('table_name = $?', table);
    if (record_id) add('record_id = $?', parseInt(record_id, 10));
    if (source) add('source = $?', source);
    if (from) add('created_at >= $?', from);
    if (to) add('created_at < ($?::date + 1)', to);
    if (q) add('(path ILIKE $? OR actor_name ILIKE $? OR table_name ILIKE $?)'.replace(/\$\?/g, () => '$' + (params.length + 1)), `%${q}%`);

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await query(
      `SELECT * FROM activity_log ${clause} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*)::int AS count FROM activity_log ${clause}`, params
    );

    res.json({
      total: count,
      rows: rows.map(r => ({ ...r, table_label: r.table_name ? (TABLE_LABEL[r.table_name] || r.table_name) : null })),
    });
  } catch (err) {
    console.error('activity list:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/activity/request/:rid — one request and every row it changed
router.get('/request/:rid', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM activity_log WHERE request_id = $1 ORDER BY source DESC, id ASC`,
      [req.params.rid]
    );
    res.json(rows.map(r => ({ ...r, table_label: r.table_name ? (TABLE_LABEL[r.table_name] || r.table_name) : null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/activity/filters — the values worth offering in the UI
router.get('/filters', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { rows: actors } = await query(
      `SELECT DISTINCT actor_id AS id, actor_name AS name FROM activity_log
       WHERE actor_id IS NOT NULL ORDER BY actor_name`
    );
    const { rows: tables } = await query(
      `SELECT DISTINCT table_name FROM activity_log WHERE table_name IS NOT NULL ORDER BY table_name`
    );
    res.json({
      actors,
      tables: tables.map(t => ({ value: t.table_name, label: TABLE_LABEL[t.table_name] || t.table_name })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
