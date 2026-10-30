// Turns a recorded row change into a sentence a person can read.
//
// Done when the log is read rather than when it is written, so it also applies to
// entries already stored and to changes made straight in the database, which never
// passed through a route that could have described itself.

const money = (v) => {
  const n = parseFloat(v);
  if (!isFinite(n)) return String(v ?? '—');
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const qty = (v) => {
  const n = parseFloat(v);
  return isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : String(v ?? '—');
};
const plain = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const bool = (v) => (v === true || v === 'true' ? 'yes' : 'no');
const date = (v) => (v ? String(v).slice(0, 10) : '—');

// How each field reads, and how its value is written out.
const FIELD = {
  quantity:        { label: 'quantity', fmt: qty },
  price:           { label: 'price', fmt: money },
  total:           { label: 'amount', fmt: money },
  brokerage:       { label: 'brokerage', fmt: money },
  amount:          { label: 'amount', fmt: money },
  avg_buy_price:   { label: 'average buy price', fmt: money },
  current_price:   { label: 'price', fmt: money },
  previous_close:  { label: 'previous close', fmt: money },
  executed_at:     { label: 'date', fmt: date },
  is_active:       { label: 'active', fmt: bool },
  investment_settled: { label: 'investment settled', fmt: bool },
  pnl_settled:     { label: 'P&L settled', fmt: bool },
  stop_loss:       { label: 'stop loss', fmt: money },
  target:          { label: 'target', fmt: money },
  label:           { label: 'name', fmt: plain },
  notes:           { label: 'notes', fmt: plain },
  status:          { label: 'status', fmt: plain },
  name:            { label: 'name', fmt: plain },
  email:           { label: 'email', fmt: plain },
  role:            { label: 'role', fmt: plain },
  user_type:       { label: 'type', fmt: plain },
  sector:          { label: 'sector', fmt: plain },
  market_cap_category: { label: 'market cap', fmt: plain },
  cash_balance:    { label: 'cash balance', fmt: money },
  holder_id:       { label: 'account holder', fmt: plain },
};

// Bookkeeping columns nobody wants to read about.
const IGNORED = new Set(['updated_at', 'created_at', 'last_updated', 'id']);

// A stock price refresh is the scheduler doing its job every 15 minutes. Kept, but
// marked so the log does not drown in it.
const PRICE_FIELDS = new Set(['current_price', 'previous_close', 'last_updated']);

const CATEGORY = {
  transactions: 'money', holdings: 'money', brokerage_transactions: 'money',
  balances: 'money', fund_movements: 'money',
  stocks: 'config', stock_groups: 'config', stock_alerts: 'config', relationships: 'config',
  users: 'people',
  trade_requests: 'workflow', sip_plans: 'workflow', sip_installments: 'workflow',
};

function describeFields(row) {
  const before = row.before_row || {};
  const after = row.after_row || {};
  const fields = (row.changed_fields && row.changed_fields.length)
    ? row.changed_fields
    : Object.keys(after.length ? after : before);

  return fields
    .filter((f) => !IGNORED.has(f))
    .map((f) => {
      const spec = FIELD[f] || { label: f.replace(/_/g, ' '), fmt: plain };
      if (row.op === 'insert') return `${spec.label} ${spec.fmt(after[f])}`;
      if (row.op === 'delete') return `${spec.label} ${spec.fmt(before[f])}`;
      return `${spec.label} ${spec.fmt(before[f])} → ${spec.fmt(after[f])}`;
    });
}

// `names` carries the lookups the caller resolved in bulk: users, stocks, groups.
function summarise(row, names) {
  if (row.source === 'http') {
    return { summary: `${row.method} ${row.path}`, category: 'request' };
  }

  const r = row.after_row || row.before_row || {};
  const who = names.users.get(r.user_id) || (r.user_id ? `user #${r.user_id}` : null);
  const stock = names.stocks.get(r.stock_id) || (r.stock_id ? `stock #${r.stock_id}` : null);
  const group = names.groups.get(r.group_id);
  const table = row.table_name;

  let category = CATEGORY[table] || 'other';
  // Judged on the raw field list, because a touch of last_updated alone is the
  // scheduler passing through, not an edit. Matches how the query filters it.
  const rawChanged = row.changed_fields || [];
  const changed = rawChanged.filter((f) => !IGNORED.has(f));
  const priceOnly = table === 'stocks' && rawChanged.length && rawChanged.every((f) => PRICE_FIELDS.has(f));
  if (priceOnly) category = 'price';

  const details = describeFields(row);
  const detail = details.length ? details.join(', ') : null;
  const where = [stock, group].filter(Boolean).join(' · ');

  let summary;
  switch (table) {
    case 'transactions': {
      const side = r.type === 'sell' ? 'sell' : 'buy';
      if (row.op === 'insert') {
        summary = `Recorded ${who ? who + "'s " : ''}${side} of ${qty(r.quantity)} ${stock || 'shares'} at ${money(r.price)}${group ? ` (${group})` : ''}`;
      } else if (row.op === 'delete') {
        summary = `Deleted ${who ? who + "'s " : ''}${side} of ${qty(r.quantity)} ${stock || 'shares'}${group ? ` (${group})` : ''}`;
      } else {
        summary = `Changed ${who ? who + "'s " : ''}${stock || ''} ${side}${group ? ` (${group})` : ''}`;
      }
      break;
    }
    case 'holdings':
      summary = row.op === 'delete'
        ? `Removed ${who ? who + "'s " : ''}${stock || ''} holding`
        : `${who ? who + "'s " : ''}${stock || ''} holding ${row.op === 'insert' ? 'created' : 'changed'}`;
      break;
    case 'brokerage_transactions':
      summary = `${row.op === 'insert' ? 'Added' : row.op === 'delete' ? 'Removed' : 'Changed'} brokerage of ${money(r.amount)} on ${stock || 'a stock'}${group ? ` · ${group}` : ''}`;
      break;
    case 'stocks':
      if (priceOnly) {
        const b = row.before_row || {};
        summary = rawChanged.includes('current_price')
          ? `${r.symbol || stock} price ${money(b.current_price)} → ${money(r.current_price)}`
          : `${r.symbol || stock} price checked, unchanged`;
      } else if (changed.includes('is_active')) {
        summary = `${r.symbol || stock} marked ${r.is_active ? 'active' : 'inactive'}`;
      } else {
        summary = `${row.op === 'insert' ? 'Added stock' : row.op === 'delete' ? 'Deleted stock' : 'Updated stock'} ${r.symbol || stock || ''}`.trim();
      }
      break;
    case 'stock_groups':
      summary = `${row.op === 'insert' ? 'Created' : row.op === 'delete' ? 'Deleted' : 'Updated'} ${r.label || 'transaction'} on ${stock || 'a stock'}`;
      break;
    case 'users':
      summary = `${row.op === 'insert' ? 'Created' : row.op === 'delete' ? 'Deleted' : 'Updated'} ${r.user_type || 'user'} ${r.name || ''}`.trim();
      break;
    case 'balances':
      summary = `${who ? who + "'s" : "A"} cash balance ${row.op === 'insert' ? 'opened' : 'changed'}`;
      break;
    case 'fund_movements':
      summary = `${r.type === 'withdrawal' ? 'Withdrawal' : 'Deposit'} of ${money(r.amount)}${who ? ` for ${who}` : ''}`;
      break;
    case 'stock_alerts':
      summary = `${row.op === 'insert' ? 'Set' : row.op === 'delete' ? 'Removed' : 'Updated'} price alert on ${stock || 'a stock'}`;
      break;
    case 'trade_requests':
      summary = `Trade request ${row.op === 'insert' ? 'raised' : row.op === 'delete' ? 'removed' : (r.status ? r.status : 'updated')}${who ? ` by ${who}` : ''}${stock ? ` for ${stock}` : ''}`;
      break;
    case 'sip_plans':
      summary = `SIP plan ${row.op === 'insert' ? 'created' : row.op === 'delete' ? 'cancelled' : 'updated'}${who ? ` for ${who}` : ''}`;
      break;
    case 'relationships':
      summary = `Client relationship ${row.op === 'insert' ? 'linked' : row.op === 'delete' ? 'unlinked' : 'changed'}`;
      break;
    default:
      summary = `${row.op} on ${table}${where ? ` · ${where}` : ''}`;
  }

  return { summary, detail, category };
}

// Collects the ids a page of entries refers to, so they can be resolved in three
// queries rather than one per row.
function referencedIds(rows) {
  const users = new Set(), stocks = new Set(), groups = new Set();
  for (const row of rows) {
    const r = row.after_row || row.before_row;
    if (!r) continue;
    if (r.user_id) users.add(r.user_id);
    if (r.holder_id) users.add(r.holder_id);
    if (r.stock_id) stocks.add(r.stock_id);
    if (r.group_id) groups.add(r.group_id);
    if (row.table_name === 'users' && r.id) users.add(r.id);
  }
  return { users: [...users], stocks: [...stocks], groups: [...groups] };
}

module.exports = { summarise, referencedIds };
