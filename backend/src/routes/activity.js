const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { summarise, referencedIds } = require('../services/activitySummary');

// Resolves the people, stocks and transaction groups a page of entries mentions,
// in three queries rather than one per row.
async function resolveNames(rows) {
  const ids = referencedIds(rows);
  const names = { users: new Map(), stocks: new Map(), groups: new Map() };
  const load = async (list, sql, into, pick) => {
    if (!list.length) return;
    const { rows: found } = await query(sql, [list]);
    found.forEach(r => into.set(r.id, pick(r)));
  };
  await Promise.all([
    load(ids.users, 'SELECT id, name FROM users WHERE id = ANY($1)', names.users, r => r.name),
    load(ids.stocks, 'SELECT id, symbol FROM stocks WHERE id = ANY($1)', names.stocks, r => r.symbol),
    load(ids.groups, 'SELECT id, label FROM stock_groups WHERE id = ANY($1)', names.groups, r => r.label),
  ]);
  return names;
}

async function decorate(rows) {
  const names = await resolveNames(rows);
  return rows.map(r => ({ ...r, ...summarise(r, names) }));
}

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
    const { actor_id, table, source, record_id, from, to, q, category, include_price } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    const add = (sql, value) => { params.push(value); where.push(sql.replace('$?', '$' + params.length)); };
    const raw = (sql) => where.push(sql);

    if (actor_id) add('actor_id = $?', parseInt(actor_id, 10));
    if (table) add('table_name = $?', table);
    if (record_id) add('record_id = $?', parseInt(record_id, 10));
    if (source) add('source = $?', source);
    if (from) add('created_at >= $?', from);
    if (to) add('created_at < ($?::date + 1)', to);
    if (q) add('(path ILIKE $? OR actor_name ILIKE $? OR table_name ILIKE $?)'.replace(/\$\?/g, () => '$' + (params.length + 1)), `%${q}%`);

    // Categories are derived from the table and which fields moved, so they are
    // expressed here in SQL — filtering after paging would give short pages and a
    // total that disagreed with them.
    const PRICE_ONLY = `(table_name = 'stocks' AND changed_fields IS NOT NULL
      AND changed_fields <@ ARRAY['current_price','previous_close','last_updated']::text[])`;
    const CATEGORY_SQL = {
      money: `table_name IN ('transactions','holdings','brokerage_transactions','balances','fund_movements')`,
      config: `table_name IN ('stocks','stock_groups','stock_alerts','relationships') AND NOT ${PRICE_ONLY}`,
      people: `table_name = 'users'`,
      workflow: `table_name IN ('trade_requests','sip_plans','sip_installments')`,
      price: PRICE_ONLY,
      request: `source = 'http'`,
    };
    if (category && CATEGORY_SQL[category]) raw(`(${CATEGORY_SQL[category]})`);

    // The scheduler refreshes prices every 15 minutes; left in, the log would be
    // almost nothing else. Still there when asked for.
    if (!category && include_price !== '1') raw(`NOT ${PRICE_ONLY}`);

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await query(
      `SELECT * FROM activity_log ${clause} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*)::int AS count FROM activity_log ${clause}`, params
    );

    const decorated = await decorate(
      rows.map(r => ({ ...r, table_label: r.table_name ? (TABLE_LABEL[r.table_name] || r.table_name) : null }))
    );
    res.json({ total: count, rows: decorated });
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
    res.json(await decorate(
      rows.map(r => ({ ...r, table_label: r.table_name ? (TABLE_LABEL[r.table_name] || r.table_name) : null }))
    ));
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
