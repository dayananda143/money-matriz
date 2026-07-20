import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Users, Wallet, TrendingUp, LayoutGrid, ChevronUp, ChevronDown, Columns, Info, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonSearchBar, SkeletonTable } from '../../components/ui/Skeleton';

const SCHEME_COLORS = [
  { bg: 'bg-brand-50 dark:bg-brand-900/20', border: 'border-brand-200 dark:border-brand-800', active: 'bg-brand-600 border-brand-600', text: 'text-brand-700 dark:text-brand-400', num: 'text-brand-600 dark:text-brand-400' },
  { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-800', active: 'bg-sky-600 border-sky-600', text: 'text-sky-700 dark:text-sky-400', num: 'text-sky-600 dark:text-sky-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', active: 'bg-violet-600 border-violet-600', text: 'text-violet-700 dark:text-violet-400', num: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800', active: 'bg-cyan-600 border-cyan-600', text: 'text-cyan-700 dark:text-cyan-400', num: 'text-cyan-600 dark:text-cyan-400' },
  { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', active: 'bg-rose-600 border-rose-600', text: 'text-rose-700 dark:text-rose-400', num: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', active: 'bg-violet-600 border-violet-600', text: 'text-violet-700 dark:text-violet-400', num: 'text-violet-600 dark:text-violet-400' },
];

const AC_COLS = ['manager', 'scheme', 'deposited', 'cash', 'portfolio', 'unrealized_pnl', 'realized_pnl', 'total_pnl', 'aum', 'status', 'joined'];
const AC_COL_LABEL = { manager: 'Manager', scheme: 'Scheme', deposited: 'Amount Given', cash: 'Cash Balance', portfolio: 'Portfolio Value', unrealized_pnl: 'Unrealized P/L', realized_pnl: 'Realized P/L', total_pnl: 'Total P/L', aum: 'Total AUM', status: 'Status', joined: 'Joined' };

const toSlug = s => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const fromSlug = (slug, schemes) => schemes.find(s => toSlug(s) === slug) || 'All';

export default function AllClientsPage() {
  const { scheme: schemeSlug } = useParams();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [schemeTab, setSchemeTab] = useState('All');
  const [statusTab, setStatusTab] = useState('active');
  const [managerFilter, setManagerFilter] = useState(() => localStorage.getItem('all_clients_manager') || 'All');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('all_clients_cols') || 'null'); return s ? new Set(s) : new Set(AC_COLS); } catch { return new Set(AC_COLS); }
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const toggleCol = col => setVisibleCols(prev => {
    const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col);
    localStorage.setItem('all_clients_cols', JSON.stringify([...next])); return next;
  });

  function exportExcel() {
    const rows = sorted.map(c => {
      const unrealized = parseFloat(c.unrealized_pnl || 0);
      const realized = parseFloat(c.realized_pnl || 0);
      const cash = parseFloat(c.cash_balance || 0);
      const portfolio = parseFloat(c.portfolio_value || 0);
      return {
        Name: c.name,
        Email: c.email,
        Phone: c.phone || '',
        Manager: c.shareholder_name || '',
        Scheme: c.scheme || '',
        'Amount Given': parseFloat(c.total_deposited || 0),
        'Cash Balance': cash,
        'Portfolio Value': portfolio,
        'Unrealized P/L': unrealized,
        'Realized P/L': realized,
        'Total P/L': unrealized + realized,
        'Total AUM': cash + portfolio,
        Status: c.is_active ? 'Active' : 'Inactive',
        Joined: c.created_at ? fmt.date(c.created_at) : '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, `clients_${schemeTab.toLowerCase()}_${statusTab}.xlsx`);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  function InfoTip({ text }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const ref = useRef(null);
    const handleEnter = () => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
      }
      setOpen(true);
    };
    return (
      <span className="inline-flex items-center ml-0.5" onClick={e => e.stopPropagation()} onMouseEnter={handleEnter} onMouseLeave={() => setOpen(false)} ref={ref}>
        <Info size={11} className="text-gray-400 hover:text-brand-400 cursor-pointer shrink-0 transition-colors" />
        {open && (
          <span style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 9999, maxWidth: '200px' }}
            className="rounded-lg bg-gray-900 px-2.5 py-2 text-[11px] font-normal normal-case tracking-normal text-gray-100 shadow-2xl leading-[1.5] pointer-events-none border border-gray-700 whitespace-normal">
            <span className="block font-semibold text-white mb-0.5">
              {text.split('.')[0]}.
            </span>
            <span className="text-gray-400">{text.split('.').slice(1).join('.').trim()}</span>
          </span>
        )}
      </span>
    );
  }

  function SortTh({ col, children }) {
    const active = sortKey === col;
    return (
      <th
        onClick={() => handleSort(col)}
        className="sticky top-0 z-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap bg-gray-50 dark:bg-gray-800/50"
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <span className="inline-flex flex-col -space-y-0.5">
            <ChevronUp size={10} className={active && sortDir === 'asc' ? 'text-brand-600' : 'text-gray-300 dark:text-gray-600'} />
            <ChevronDown size={10} className={active && sortDir === 'desc' ? 'text-brand-600' : 'text-gray-300 dark:text-gray-600'} />
          </span>
        </span>
      </th>
    );
  }

  useEffect(() => {
    api.get('/relationships/all-clients')
      .then(r => setClients(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const schemeList = useMemo(() => {
    const set = new Set();
    clients.forEach(c => {
      if (c.scheme) c.scheme.split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
    });
    return Array.from(set).sort();
  }, [clients]);

  // Sync tab from URL param once schemes are known
  useEffect(() => {
    if (!schemeList.length) return;
    if (schemeSlug) {
      const matched = fromSlug(schemeSlug, schemeList);
      setSchemeTab(matched);
    } else {
      setSchemeTab('All');
    }
  }, [schemeSlug, schemeList.join(',')]);

  const selectScheme = (scheme) => {
    setPage(1);
    if (scheme === 'All') {
      navigate('/admin/clients');
    } else {
      navigate(`/admin/clients/${toSlug(scheme)}`);
    }
  };

  // Per-scheme stats (active clients only)
  const schemeStats = useMemo(() => {
    const activeClients = clients.filter(c => c.is_active);
    const all = {
      scheme: 'All',
      count: activeClients.length,
      portfolio: activeClients.reduce((s, c) => s + parseFloat(c.portfolio_value || 0), 0),
      cash: activeClients.reduce((s, c) => s + parseFloat(c.cash_balance || 0), 0),
      deposited: activeClients.reduce((s, c) => s + parseFloat(c.total_deposited || 0), 0),
      activeInvested: activeClients.reduce((s, c) => s + parseFloat(c.active_invested || 0), 0),
    };
    const perScheme = schemeList.map((s, i) => {
      const sc = activeClients.filter(c => c.scheme && c.scheme.split(',').map(x => x.trim()).includes(s));
      return {
        scheme: s,
        count: sc.length,
        portfolio: sc.reduce((sum, c) => sum + parseFloat(c.portfolio_value || 0), 0),
        cash: sc.reduce((sum, c) => sum + parseFloat(c.cash_balance || 0), 0),
        deposited: sc.reduce((sum, c) => sum + parseFloat(c.total_deposited || 0), 0),
        activeInvested: sc.reduce((sum, c) => sum + parseFloat(c.active_invested || 0), 0),
        color: SCHEME_COLORS[i % SCHEME_COLORS.length],
      };
    });
    return [all, ...perScheme];
  }, [clients, schemeList]);

  const managers = useMemo(() => {
    const set = new Set();
    clients.forEach(c => { if (c.shareholder_name) set.add(c.shareholder_name); });
    return ['All', ...Array.from(set).sort()];
  }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = !search.trim() ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.shareholder_name || '').toLowerCase().includes(search.toLowerCase());
      const matchScheme = schemeTab === 'All' ||
        (c.scheme && c.scheme.split(',').map(s => s.trim()).includes(schemeTab));
      const matchStatus = statusTab === 'active' ? c.is_active : !c.is_active;
      const matchManager = managerFilter === 'All' || c.shareholder_name === managerFilter;
      return matchSearch && matchScheme && matchStatus && matchManager;
    });
  }, [clients, search, schemeTab, statusTab, managerFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortKey === 'name') { av = a.name?.toLowerCase() || ''; bv = b.name?.toLowerCase() || ''; }
      else if (sortKey === 'manager') { av = (a.shareholder_name || '').toLowerCase(); bv = (b.shareholder_name || '').toLowerCase(); }
      else if (sortKey === 'deposited') { av = parseFloat(a.total_deposited || 0); bv = parseFloat(b.total_deposited || 0); }
      else if (sortKey === 'cash') { av = parseFloat(a.cash_balance || 0); bv = parseFloat(b.cash_balance || 0); }
      else if (sortKey === 'portfolio') { av = parseFloat(a.portfolio_value || 0); bv = parseFloat(b.portfolio_value || 0); }
      else if (sortKey === 'unrealized_pnl') { av = parseFloat(a.unrealized_pnl || 0); bv = parseFloat(b.unrealized_pnl || 0); }
      else if (sortKey === 'realized_pnl') { av = parseFloat(a.realized_pnl || 0); bv = parseFloat(b.realized_pnl || 0); }
      else if (sortKey === 'total_pnl') { av = parseFloat(a.unrealized_pnl || 0) + parseFloat(a.realized_pnl || 0); bv = parseFloat(b.unrealized_pnl || 0) + parseFloat(b.realized_pnl || 0); }
      else if (sortKey === 'aum') { av = parseFloat(a.cash_balance || 0) + parseFloat(a.portfolio_value || 0); bv = parseFloat(b.cash_balance || 0) + parseFloat(b.portfolio_value || 0); }
      else if (sortKey === 'joined') { av = new Date(a.created_at); bv = new Date(b.created_at); }
      else { av = a[sortKey]; bv = b[sortKey]; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paged = sorted.slice((page - 1) * limit, page * limit);
  const totalCash = sorted.reduce((s, c) => s + parseFloat(c.cash_balance || 0), 0);
  const totalPortfolio = sorted.reduce((s, c) => s + parseFloat(c.portfolio_value || 0), 0);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonSearchBar />
      <SkeletonTable rows={8} cols={9} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Clients</h1>
        <p className="text-gray-500 text-sm mt-1">{clients.filter(c => c.is_active).length} active · {clients.length} total</p>
      </div>

      {/* Scheme summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {schemeStats.map((s, i) => {
          const isAll = s.scheme === 'All';
          const color = isAll ? null : s.color;
          const isSelected = schemeTab === s.scheme;
          return (
            <button
              key={s.scheme}
              onClick={() => selectScheme(s.scheme)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                isSelected
                  ? isAll
                    ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                    : `${color.active} border-transparent`
                  : isAll
                    ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    : `${color.bg} ${color.border} hover:shadow-md`
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  isSelected
                    ? 'text-white dark:text-gray-900'
                    : isAll ? 'text-gray-500 dark:text-gray-400' : color.text
                }`}>
                  {s.scheme === 'All' ? 'All Schemes' : s.scheme.replace(/_/g, ' ')}
                </span>
                <span className={`text-lg font-bold ${
                  isSelected ? 'text-white dark:text-gray-900' : isAll ? 'text-gray-900 dark:text-white' : color.num
                }`}>{s.count}</span>
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
                <div className={`flex justify-between gap-2 pt-1 border-t ${isSelected ? 'border-white/20 dark:border-gray-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <span className="font-medium">Total AUM</span>
                  <span className={`font-bold ${isSelected ? 'text-white dark:text-gray-900' : isAll ? 'text-gray-900 dark:text-white' : color.num}`}>{fmt.currency(s.portfolio + s.cash)}</span>
                </div>
                {s.deposited > 0 && (() => {
                  const pnl = s.portfolio + s.cash - s.deposited;
                  const pct = (pnl / s.deposited) * 100;
                  return (
                    <div className={`flex justify-between gap-2 pt-0.5`}>
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

      <div className="card">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-wrap gap-2 p-3">
          <div className="flex items-center gap-1">
            {['active', 'inactive'].map(s => {
              const count = clients.filter(c => {
                const matchScheme = schemeTab === 'All' || (c.scheme && c.scheme.split(',').map(x => x.trim()).includes(schemeTab));
                return matchScheme && (s === 'active' ? c.is_active : !c.is_active);
              }).length;
              return (
                <button key={s} onClick={() => { setStatusTab(s); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium capitalize transition-colors ${statusTab === s ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  {s} <span className={`text-xs ml-0.5 ${statusTab === s ? 'text-brand-200' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={managerFilter}
              onChange={e => { setManagerFilter(e.target.value); localStorage.setItem('all_clients_manager', e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              {managers.map(m => <option key={m} value={m}>{m === 'All' ? 'All Managers' : m}</option>)}
            </select>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
              <FileSpreadsheet size={12} /> Excel
            </button>
            <div className="relative">
              <button onClick={() => setColMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <Columns size={12} /> Columns <span className="text-brand-600 dark:text-brand-400">{visibleCols.size}</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-44">
                  {AC_COLS.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={visibleCols.has(col)} onChange={() => toggleCol(col)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                      {AC_COL_LABEL[col]}
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
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-8 pr-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-48"
                placeholder="Search name, email, manager…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <SortTh col="name">Client</SortTh>
              {visibleCols.has('manager') && <SortTh col="manager">Manager</SortTh>}
              {visibleCols.has('scheme') && <Th>Scheme</Th>}
              {visibleCols.has('deposited') && <SortTh col="deposited">Amount Given</SortTh>}
              {visibleCols.has('cash') && <SortTh col="cash">Cash Balance</SortTh>}
              {visibleCols.has('portfolio') && <SortTh col="portfolio">Portfolio Value</SortTh>}
              {visibleCols.has('unrealized_pnl') && <SortTh col="unrealized_pnl">Unrealized P/L<InfoTip text="Gain or loss on holdings still in the portfolio. Calculated as current market value minus the average buy price of open positions." /></SortTh>}
              {visibleCols.has('realized_pnl') && <SortTh col="realized_pnl">Realized P/L<InfoTip text="Profit or loss locked in from sold positions. Calculated as sell proceeds minus the cost of shares that have been fully or partially exited." /></SortTh>}
              {visibleCols.has('total_pnl') && <SortTh col="total_pnl">Total P/L<InfoTip text="Combined profit or loss across all activity. Sum of unrealized P/L (open holdings) and realized P/L (closed positions), giving a single view of overall performance." /></SortTh>}
              {visibleCols.has('aum') && <SortTh col="aum">Total AUM</SortTh>}
              {visibleCols.has('status') && <Th>Status</Th>}
              {visibleCols.has('joined') && <SortTh col="joined">Joined</SortTh>}
            </tr>
          </thead>
          <tbody>
            {!paged.length && <EmptyRow cols={visibleCols.size + 1} message="No clients found" />}
            {paged.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>
                  <Link to={`/clients/${c.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                    {c.name}
                  </Link>
                  <p className="text-xs text-gray-400">{c.email}</p>
                  {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                </Td>
                {visibleCols.has('manager') && <Td className="text-sm text-gray-600 dark:text-gray-300">{c.shareholder_name || <span className="text-gray-400">Unassigned</span>}</Td>}
                {visibleCols.has('scheme') && <Td>
                  {(() => { const sc = c.scheme ? c.scheme.split(',').map(s => s.trim()).filter(Boolean) : []; return sc.length ? <span className="px-1.5 py-0.5 text-xs rounded bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300">{sc.map(s => s.replace(/_/g, ' ')).join(', ')}</span> : <span className="text-gray-400">—</span>; })()}
                </Td>}
                {visibleCols.has('deposited') && <Td>{fmt.currency(c.total_deposited)}</Td>}
                {visibleCols.has('cash') && <Td>{fmt.currency(c.cash_balance)}</Td>}
                {visibleCols.has('portfolio') && <Td>{fmt.currency(c.portfolio_value)}</Td>}
                {visibleCols.has('unrealized_pnl') && (() => { const v = parseFloat(c.unrealized_pnl || 0); const base = parseFloat(c.portfolio_value || 0) - v; const pct = base !== 0 ? (v / Math.abs(base)) * 100 : null; const cls = v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'; return <Td><span className={`font-medium ${cls}`}>{v >= 0 ? '+' : ''}{fmt.currency(v)}</span>{pct !== null && <span className={`ml-1 text-xs ${cls}`}>({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>}</Td>; })()}
                {visibleCols.has('realized_pnl') && (() => { const v = parseFloat(c.realized_pnl || 0); const base = parseFloat(c.total_deposited || 0); const pct = base !== 0 ? (v / base) * 100 : null; const cls = v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'; return <Td><span className={`font-medium ${cls}`}>{v >= 0 ? '+' : ''}{fmt.currency(v)}</span>{pct !== null && <span className={`ml-1 text-xs ${cls}`}>({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>}</Td>; })()}
                {visibleCols.has('total_pnl') && (() => { const v = parseFloat(c.unrealized_pnl || 0) + parseFloat(c.realized_pnl || 0); const base = parseFloat(c.total_deposited || 0); const pct = base !== 0 ? (v / base) * 100 : null; const cls = v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'; return <Td><span className={`font-medium ${cls}`}>{v >= 0 ? '+' : ''}{fmt.currency(v)}</span>{pct !== null && <span className={`ml-1 text-xs ${cls}`}>({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>}</Td>; })()}
                {visibleCols.has('aum') && <Td className="font-medium">{fmt.currency(parseFloat(c.cash_balance) + parseFloat(c.portfolio_value))}</Td>}
                {visibleCols.has('status') && <Td><span className={c.is_active ? 'badge-green' : 'badge-red'}>{c.is_active ? 'Active' : 'Inactive'}</span></Td>}
                {visibleCols.has('joined') && <Td className="text-gray-500 text-xs">{fmt.date(c.created_at)}</Td>}
              </tr>
            ))}
            {paged.length > 0 && (
              <tr className="bg-gray-50 dark:bg-gray-800/60 font-semibold text-xs border-t-2 border-gray-200 dark:border-gray-600">
                <Td className="text-gray-500">Showing {paged.length} of {sorted.length}</Td>
                {visibleCols.has('manager') && <Td />}
                {visibleCols.has('scheme') && <Td />}
                {visibleCols.has('deposited') && <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(sorted.reduce((s, c) => s + parseFloat(c.total_deposited || 0), 0))}</Td>}
                {visibleCols.has('cash') && <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(totalCash)}</Td>}
                {visibleCols.has('portfolio') && <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(totalPortfolio)}</Td>}
                {visibleCols.has('unrealized_pnl') && (() => { const t = sorted.reduce((s, c) => s + parseFloat(c.unrealized_pnl || 0), 0); return <Td className={`font-bold ${t >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{t >= 0 ? '+' : ''}{fmt.currency(t)}</Td>; })()}
                {visibleCols.has('realized_pnl') && (() => { const t = sorted.reduce((s, c) => s + parseFloat(c.realized_pnl || 0), 0); return <Td className={`font-bold ${t >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{t >= 0 ? '+' : ''}{fmt.currency(t)}</Td>; })()}
                {visibleCols.has('total_pnl') && (() => { const t = sorted.reduce((s, c) => s + parseFloat(c.unrealized_pnl || 0) + parseFloat(c.realized_pnl || 0), 0); return <Td className={`font-bold ${t >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{t >= 0 ? '+' : ''}{fmt.currency(t)}</Td>; })()}
                {visibleCols.has('aum') && <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(totalCash + totalPortfolio)}</Td>}
                {visibleCols.has('status') && <Td />}
                {visibleCols.has('joined') && <Td />}
              </tr>
            )}
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
    </div>
  );
}
