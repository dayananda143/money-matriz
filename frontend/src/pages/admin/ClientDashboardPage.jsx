import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, ArrowLeft, Columns } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonTable } from '../../components/ui/Skeleton';

const SCHEME_COLORS = [
  { bg: 'bg-brand-50 dark:bg-brand-900/20', border: 'border-brand-200 dark:border-brand-800', active: 'bg-brand-600 border-brand-600', text: 'text-brand-700 dark:text-brand-400', num: 'text-brand-600 dark:text-brand-400' },
  { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-800', active: 'bg-sky-600 border-sky-600', text: 'text-sky-700 dark:text-sky-400', num: 'text-sky-600 dark:text-sky-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', active: 'bg-violet-600 border-violet-600', text: 'text-violet-700 dark:text-violet-400', num: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800', active: 'bg-cyan-600 border-cyan-600', text: 'text-cyan-700 dark:text-cyan-400', num: 'text-cyan-600 dark:text-cyan-400' },
  { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', active: 'bg-rose-600 border-rose-600', text: 'text-rose-700 dark:text-rose-400', num: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', active: 'bg-violet-600 border-violet-600', text: 'text-violet-700 dark:text-violet-400', num: 'text-violet-600 dark:text-violet-400' },
];

function buildSchemeStats(clients) {
  const activeClients = clients.filter(c => c.is_active);
  const schemeSet = new Set();
  activeClients.forEach(c => {
    if (c.scheme) c.scheme.split(',').map(s => s.trim()).filter(Boolean).forEach(s => schemeSet.add(s));
  });
  const schemeList = Array.from(schemeSet).sort();

  const agg = (list) => ({
    count: list.length,
    portfolio: list.reduce((s, c) => s + parseFloat(c.portfolio_value || 0), 0),
    cash: list.reduce((s, c) => s + parseFloat(c.cash_balance || 0), 0),
    deposited: list.reduce((s, c) => s + parseFloat(c.total_deposited || 0), 0),
    activeInvested: list.reduce((s, c) => s + parseFloat(c.active_invested || 0), 0),
    realizedPnl: list.reduce((s, c) => s + parseFloat(c.realized_pnl || 0), 0),
  });

  const all = { scheme: 'All', ...agg(activeClients) };
  const perScheme = schemeList.map((s, i) => ({
    scheme: s,
    ...agg(activeClients.filter(c => c.scheme && c.scheme.split(',').map(x => x.trim()).includes(s))),
    color: SCHEME_COLORS[i % SCHEME_COLORS.length],
  }));
  return [all, ...perScheme];
}

function SchemeCards({ clients, schemeFilter, onSchemeFilter }) {
  const stats = useMemo(() => buildSchemeStats(clients), [clients]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => {
        const isAll = s.scheme === 'All';
        const color = isAll ? null : s.color;
        const isSelected = schemeFilter === s.scheme;
        return (
          <button key={s.scheme} onClick={() => onSchemeFilter(s.scheme)}
            className={`text-left rounded-xl border-2 p-4 transition-all ${
              isSelected
                ? isAll ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white' : `${color.active} border-transparent`
                : isAll ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500' : `${color.bg} ${color.border} hover:shadow-md`
            }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isSelected ? 'text-white dark:text-gray-900' : isAll ? 'text-gray-500 dark:text-gray-400' : color.text}`}>
                {s.scheme === 'All' ? 'All Schemes' : s.scheme.replace(/_/g, ' ')}
              </span>
              <span className={`text-lg font-bold ${isSelected ? 'text-white dark:text-gray-900' : isAll ? 'text-gray-900 dark:text-white' : color.num}`}>{s.count}</span>
            </div>
            <div className={`text-xs space-y-0.5 ${isSelected ? 'text-white/80 dark:text-gray-900/70' : 'text-gray-500 dark:text-gray-400'}`}>
              <div className="flex justify-between gap-2">
                <span>Given</span>
                <span className={`font-medium ${isSelected ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>{fmt.currency(s.deposited)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Invested</span>
                <span className={`font-medium ${isSelected ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>{fmt.currency(s.activeInvested)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Portfolio</span>
                <span className={`font-medium ${isSelected ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>{fmt.currency(s.portfolio)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Cash</span>
                <span className={`font-medium ${isSelected ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>{fmt.currency(s.cash)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Realized P&amp;L</span>
                <span className={`font-medium ${isSelected ? 'text-white dark:text-gray-900' : s.realizedPnl >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {s.realizedPnl >= 0 ? '+' : ''}{fmt.currency(s.realizedPnl)}
                </span>
              </div>
              <div className={`flex justify-between gap-2 pt-1 border-t ${isSelected ? 'border-white/20 dark:border-gray-900/20' : isAll ? 'border-gray-200 dark:border-gray-700' : 'border-current/10'}`}>
                <span className="font-medium">Total AUM</span>
                <span className={`font-bold ${isSelected ? 'text-white dark:text-gray-900' : isAll ? 'text-gray-900 dark:text-white' : color.num}`}>{fmt.currency(s.portfolio + s.cash)}</span>
              </div>
              {s.deposited > 0 && (() => {
                const pnl = s.portfolio + s.cash - s.deposited;
                const pct = (pnl / s.deposited) * 100;
                return (
                  <div className="flex justify-between gap-2 pt-0.5">
                    <span className="font-medium">P&amp;L</span>
                    <span className={`font-bold ${pnl >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {pct >= 0 ? '+' : ''}{fmt.percent(pct)}
                    </span>
                  </div>
                );
              })()}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const CD_COLS = ['manager', 'scheme', 'portfolio', 'cash', 'total_aum'];
const CD_COL_LABEL = { manager: 'Manager', scheme: 'Scheme', portfolio: 'Portfolio', cash: 'Cash', total_aum: 'Total AUM' };

function ClientsTable({ clients }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('client_dashboard_cols') || 'null'); return s ? new Set(s) : new Set(CD_COLS); } catch { return new Set(CD_COLS); }
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const toggleCol = col => setVisibleCols(prev => {
    const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col);
    localStorage.setItem('client_dashboard_cols', JSON.stringify([...next])); return next;
  });

  const sorted = useMemo(() =>
    [...clients]
      .filter(c => c.is_active)
      .sort((a, b) => (parseFloat(b.portfolio_value) + parseFloat(b.cash_balance)) - (parseFloat(a.portfolio_value) + parseFloat(a.cash_balance)))
  , [clients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.scheme?.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paged = filtered.slice((page - 1) * limit, page * limit);

  // Reset to page 1 when clients or limit changes
  useMemo(() => setPage(1), [clients, limit]);

  return (
    <div className="card">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900 dark:text-white">Clients</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or scheme…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
            />
          </div>
          <div className="relative">
              <button onClick={() => setColMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <Columns size={12} /> Columns <span className="text-brand-600 dark:text-brand-400">{visibleCols.size}</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-40">
                  {CD_COLS.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={visibleCols.has(col)} onChange={() => toggleCol(col)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                      {CD_COL_LABEL[col]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
            {[5, 10, 15, 20, 25].map(n => (
              <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                className={`px-2.5 py-1 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Client</Th>
            {visibleCols.has('manager') && <Th>Manager</Th>}
            {visibleCols.has('scheme') && <Th>Scheme</Th>}
            {visibleCols.has('portfolio') && <Th>Portfolio</Th>}
            {visibleCols.has('cash') && <Th>Cash</Th>}
            {visibleCols.has('total_aum') && <Th>Total AUM</Th>}
          </tr>
        </thead>
        <tbody>
          {!paged.length && <EmptyRow cols={visibleCols.size + 1} message="No clients" />}
          {paged.map(c => (
            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <Td>
                <Link to={`/clients/${c.id}`} className="font-medium text-brand-600 hover:text-brand-700 text-sm">{c.name}</Link>
                <p className="text-xs text-gray-400">{c.email}</p>
              </Td>
              {visibleCols.has('manager') && <Td className="text-xs text-gray-500">{c.shareholder_name || '—'}</Td>}
              {visibleCols.has('scheme') && <Td>
                {(() => {
                  const sc = c.scheme ? c.scheme.split(',').map(s => s.trim()).filter(Boolean) : [];
                  return sc.length
                    ? <span className="px-1.5 py-0.5 text-xs rounded bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300">{sc.map(s => s.replace(/_/g, ' ')).join(', ')}</span>
                    : <span className="text-gray-400">—</span>;
                })()}
              </Td>}
              {visibleCols.has('portfolio') && <Td className="font-medium text-sm">{fmt.currency(c.portfolio_value)}</Td>}
              {visibleCols.has('cash') && <Td className="text-sm">{fmt.currency(c.cash_balance)}</Td>}
              {visibleCols.has('total_aum') && <Td className="font-semibold text-sm">{fmt.currency(parseFloat(c.portfolio_value) + parseFloat(c.cash_balance))}</Td>}
            </tr>
          ))}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
              <ChevronLeft size={14} />
            </button>
            {(() => {
              const range = [];
              for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
              }
              const out = []; let prev = null;
              for (const p of range) { if (prev !== null && p - prev > 1) out.push('...' + p); out.push(p); prev = p; }
              return out.map((p, i) => typeof p === 'string'
                ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                : <button key={p} onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p}</button>
              );
            })()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'my';
  const [schemeFilter, setSchemeFilter] = useState('All');
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const setTab = (t) => setSearchParams({ tab: t }, { replace: true });

  useEffect(() => {
    api.get('/relationships/all-clients?scope=all')
      .then(r => {
        setAllClients(r.data);
        // If shareholder has no assigned clients, default to all tab
        const mine = r.data.filter(c => c.shareholder_id === user?.id);
        if (!mine.length && tab === 'my') setTab('all');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  const myClients = useMemo(
    () => allClients.filter(c => c.shareholder_id === user?.id),
    [allClients, user?.id]
  );

  const baseClients = tab === 'my' ? myClients : allClients;
  const clients = schemeFilter === 'All'
    ? baseClients
    : baseClients.filter(c => c.scheme && c.scheme.split(',').map(s => s.trim()).includes(schemeFilter));

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={5} cols={5} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Client Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Overview of all clients on the platform</p>
          </div>
        </div>
        {myClients.length > 0 && (
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm font-medium">
            {[{ key: 'my', label: 'My Clients' }, { key: 'all', label: 'All Clients' }].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setSchemeFilter('All'); }}
                className={`px-4 py-2 transition-colors ${tab === t.key ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <SchemeCards clients={baseClients} schemeFilter={schemeFilter} onSchemeFilter={setSchemeFilter} />
      <ClientsTable clients={clients} />
    </div>
  );
}
