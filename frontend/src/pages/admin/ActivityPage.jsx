import { useEffect, useState } from 'react';
import { History, Database, Globe, ChevronRight } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonTable } from '../../components/ui/Skeleton';

const SOURCE_LABEL = {
  http: { text: 'Request', cls: 'badge-blue', icon: Globe },
  row: { text: 'Change', cls: 'badge-green', icon: History },
  database: { text: 'Direct DB', cls: 'badge-red', icon: Database },
};

const OP_LABEL = { insert: 'Created', update: 'Changed', delete: 'Deleted' };

// Values are shown as they are stored; only the fields that actually moved appear.
function Diff({ row }) {
  const fields = row.changed_fields
    || Object.keys(row.after_row || row.before_row || {});
  if (!fields.length) return null;
  const before = row.before_row || {};
  const after = row.after_row || {};
  return (
    <div className="mt-2 space-y-1">
      {fields.map(f => (
        <div key={f} className="flex flex-wrap items-baseline gap-2 text-xs">
          <span className="text-gray-400 dark:text-gray-500 font-mono">{f}</span>
          {row.op !== 'insert' && (
            <span className="font-mono text-red-500 line-through break-all">{String(before[f] ?? '—')}</span>
          )}
          {row.op !== 'delete' && (
            <>
              {row.op !== 'insert' && <ChevronRight size={11} className="text-gray-400" />}
              <span className="font-mono text-green-600 dark:text-green-400 break-all">{String(after[f] ?? '—')}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ActivityPage() {
  const [data, setData] = useState({ rows: [], total: 0 });
  const [filters, setFilters] = useState({ actors: [], tables: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState({ actor_id: '', table: '', source: '', from: '', to: '' });
  const limit = 50;

  useEffect(() => {
    api.get('/activity/filters').then(r => setFilters(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit, offset: (page - 1) * limit });
    Object.entries(sel).forEach(([k, v]) => { if (v) params.set(k, v); });
    api.get(`/activity?${params}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sel, page]);

  const setFilter = (k, v) => { setSel(s => ({ ...s, [k]: v })); setPage(1); };
  const totalPages = Math.max(1, Math.ceil(data.total / limit));

  if (loading && !data.rows.length) return (
    <div className="space-y-6"><SkeletonPageHeader /><SkeletonTable rows={10} cols={5} /></div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every change made to the system, including ones made directly in the database.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto text-sm" value={sel.actor_id} onChange={e => setFilter('actor_id', e.target.value)}>
          <option value="">Anyone</option>
          {filters.actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input w-auto text-sm" value={sel.table} onChange={e => setFilter('table', e.target.value)}>
          <option value="">Anything</option>
          {filters.tables.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="input w-auto text-sm" value={sel.source} onChange={e => setFilter('source', e.target.value)}>
          <option value="">All sources</option>
          <option value="row">Changes via the app</option>
          <option value="database">Direct database changes</option>
          <option value="http">Requests</option>
        </select>
        <input type="date" className="input w-auto text-sm" value={sel.from} onChange={e => setFilter('from', e.target.value)} aria-label="From date" />
        <input type="date" className="input w-auto text-sm" value={sel.to} onChange={e => setFilter('to', e.target.value)} aria-label="To date" />
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {data.total.toLocaleString('en-IN')} entries
        </span>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Source</Th>
            <Th>What</Th>
            <Th>Detail</Th>
          </tr>
        </thead>
        <tbody>
          {!data.rows.length && <EmptyRow cols={5} message="Nothing recorded yet" />}
          {data.rows.map(r => {
            const s = SOURCE_LABEL[r.source] || SOURCE_LABEL.row;
            const Icon = s.icon;
            const open = expanded === r.id;
            const hasDetail = r.source === 'http' ? !!r.request_body : true;
            return (
              <tr key={r.id}
                onClick={() => hasDetail && setExpanded(open ? null : r.id)}
                className={hasDetail ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}>
                <Td className="whitespace-nowrap text-xs text-gray-500">{fmt.datetime(r.created_at)}</Td>
                <Td className="whitespace-nowrap">
                  {r.actor_name
                    ? <span className="text-gray-900 dark:text-white">{r.actor_name}</span>
                    : <span className="text-gray-400 italic">not through the app</span>}
                </Td>
                <Td><span className={s.cls}><Icon size={11} className="inline mr-1" />{s.text}</span></Td>
                <Td>
                  {r.source === 'http'
                    ? <span className="font-mono text-xs">{r.method} {r.path}</span>
                    : <span>{OP_LABEL[r.op] || r.op} <strong>{r.table_label}</strong> <span className="text-gray-400">#{r.record_id}</span></span>}
                </Td>
                <Td>
                  {r.source === 'http'
                    ? <span className={r.status_code >= 400 ? 'text-red-500 font-medium' : 'text-gray-500'}>
                        {r.status_code} · {r.duration_ms}ms
                      </span>
                    : <span className="text-xs text-gray-500">
                        {(r.changed_fields || []).length
                          ? `${r.changed_fields.length} field${r.changed_fields.length === 1 ? '' : 's'}`
                          : OP_LABEL[r.op]}
                      </span>}
                  {open && (
                    <div onClick={e => e.stopPropagation()}>
                      {r.source === 'http'
                        ? <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto">{JSON.stringify(r.request_body, null, 2)}</pre>
                        : <Diff row={r} />}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn-secondary text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button className="btn-secondary text-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
