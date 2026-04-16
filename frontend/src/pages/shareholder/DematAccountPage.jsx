import { useEffect, useState } from 'react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { Landmark, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

function SortTh({ label, col, sort, onSort, children }) {
  const active = sort.key === col;
  return (
    <Th>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 transition-colors whitespace-nowrap">
        {label || children}
        <span className={`text-xs ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-300 dark:text-gray-600'}`}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}
        </span>
      </button>
    </Th>
  );
}

const USER_TYPES = [
  { label: 'Employee', filter: u => u.role === 'admin' || u.role === 'super_admin' },
  { label: 'Shareholder', filter: u => u.user_type === 'shareholder' },
  { label: 'Client', filter: u => u.user_type === 'client' },
];

function getDefaultType(u) {
  if (u?.user_type === 'shareholder') return 'Shareholder';
  if (u?.user_type === 'client') return 'Client';
  return 'Employee';
}

function DematContent({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [sort, setSort] = useState({ key: 'symbol', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setData(null);
    const url = userId === 'me' ? '/stocks/my-demat' : `/stocks/brokerage-accounts/holder/${userId}`;
    api.get(url)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={6} cols={6} />
    </div>
  );

  const holdings = data || [];
  const activeHoldings = holdings.filter(h => parseFloat(h.total_bought) - parseFloat(h.total_sold) > 0);
  const exitedHoldings = holdings.filter(h => parseFloat(h.total_bought) - parseFloat(h.total_sold) <= 0);
  const displayed = tab === 'active' ? activeHoldings : exitedHoldings;
  const totalInvested = activeHoldings.reduce((s, h) => s + parseFloat(h.total_invested), 0);
  const totalCurrentValue = activeHoldings.reduce((s, h) => {
    const remaining = parseFloat(h.total_bought) - parseFloat(h.total_sold);
    return s + remaining * parseFloat(h.current_price);
  }, 0);

  const handleSort = (col) => {
    setSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const getSortValue = (h, key) => {
    if (key === 'symbol') return h.symbol;
    if (key === 'group_label') return h.group_label;
    if (key === 'total_bought') return parseFloat(h.total_bought);
    if (key === 'remaining') return parseFloat(h.total_bought) - parseFloat(h.total_sold);
    if (key === 'total_invested') return parseFloat(h.total_invested);
    if (key === 'current_price') return parseFloat(h.current_price);
    if (key === 'current_value') return (parseFloat(h.total_bought) - parseFloat(h.total_sold)) * parseFloat(h.current_price);
    if (key === 'total_sell_amount') return parseFloat(h.total_sell_amount);
    if (key === 'investment_settled') return h.investment_settled ? 1 : 0;
    if (key === 'pnl_settled') return h.pnl_settled ? 1 : 0;
    return h[key] ?? '';
  };

  const filtered = displayed.filter(h => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return h.symbol?.toLowerCase().includes(q) || h.stock_name?.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sort.key);
    const bv = getSortValue(b, sort.key);
    const numA = parseFloat(av), numB = parseFloat(bv);
    const isNum = !isNaN(numA) && !isNaN(numB);
    const cmp = isNum ? numA - numB : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paged = sorted.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Stocks</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{holdings.length}</p>
          <p className="text-xs text-gray-400 mt-1">{activeHoldings.length} active</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Invested</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalInvested)}</p>
          <p className="text-xs text-gray-400 mt-1">Amount deployed</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Current Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalCurrentValue)}</p>
          <p className="text-xs text-gray-400 mt-1">Active holdings</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Unrealized P&amp;L</p>
          {(() => {
            const pnl = totalCurrentValue - totalInvested;
            const pct = totalInvested > 0 ? pnl / totalInvested * 100 : 0;
            return (
              <>
                <p className={`text-xl font-bold mt-1 ${pnlColor(pnl)}`}>{pnlSign(pnl)}{fmt.currency(pnl)}</p>
                {totalInvested > 0 && <p className={`text-xs mt-1 font-medium ${pnlColor(pct)}`}>{pnlSign(pct)}{fmt.percent(pct)}</p>}
              </>
            );
          })()}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {[{ key: 'active', label: 'Active', count: activeHoldings.length }, { key: 'exited', label: 'Exited', count: exitedHoldings.length }].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                {t.label} <span className={`text-xs ml-0.5 ${tab === t.key ? 'text-brand-200' : 'text-gray-400'}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search stock…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Show</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
              {[5, 10, 20, 50].map(n => (
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
              <SortTh label="Stock" col="symbol" sort={sort} onSort={handleSort} />
              <SortTh label="Group" col="group_label" sort={sort} onSort={handleSort} />
              <SortTh label="Buy Date" col="first_buy_date" sort={sort} onSort={handleSort} />
              {tab === 'exited' && <SortTh label="Sell Date" col="last_sell_date" sort={sort} onSort={handleSort} />}
              <SortTh label="Qty Bought" col="total_bought" sort={sort} onSort={handleSort} />
              <SortTh label="Qty Remaining" col="remaining" sort={sort} onSort={handleSort} />
              <SortTh label="Total Invested" col="total_invested" sort={sort} onSort={handleSort} />
              <SortTh label="Current Price" col="current_price" sort={sort} onSort={handleSort} />
              {tab === 'active' && <SortTh label="Current Value" col="current_value" sort={sort} onSort={handleSort} />}
              {tab === 'exited' && <SortTh label="Sell Amount" col="total_sell_amount" sort={sort} onSort={handleSort} />}
              <SortTh label="Inv. Settled" col="investment_settled" sort={sort} onSort={handleSort} />
              <SortTh label="P&L Settled" col="pnl_settled" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {!paged.length && <EmptyRow cols={tab === 'exited' ? 11 : 10} message={`No ${tab} holdings found`} />}
            {paged.map(h => {
              const remaining = parseFloat(h.total_bought) - parseFloat(h.total_sold);
              const currentValue = remaining * parseFloat(h.current_price);
              return (
                <tr key={h.group_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td>
                    <span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{h.stock_name}</p>
                    {h.sector && <p className="text-xs text-gray-400">{h.sector}</p>}
                  </Td>
                  <Td className="text-sm text-gray-700 dark:text-gray-300">{h.group_label}</Td>
                  <Td className="text-xs text-gray-500">{h.first_buy_date ? new Date(h.first_buy_date).toLocaleDateString('en-IN') : '—'}</Td>
                  {tab === 'exited' && <Td className="text-xs text-gray-500">{h.last_sell_date ? new Date(h.last_sell_date).toLocaleDateString('en-IN') : '—'}</Td>}
                  <Td className="font-medium">{fmt.number(h.total_bought, 2)}</Td>
                  <Td className="font-medium">{fmt.number(remaining, 2)}</Td>
                  <Td>{fmt.currency(h.total_invested)}</Td>
                  <Td className="font-medium">{fmt.currency(h.current_price)}</Td>
                  {tab === 'active' && <Td className="font-medium">{fmt.currency(currentValue)}</Td>}
                  {tab === 'exited' && <Td>{parseFloat(h.total_sell_amount) > 0 ? fmt.currency(h.total_sell_amount) : <span className="text-gray-400">—</span>}</Td>}
                  <Td><span className={h.investment_settled ? 'badge-green' : 'badge-gray'}>{h.investment_settled ? 'Yes' : 'No'}</span></Td>
                  <Td><span className={h.pnl_settled ? 'badge-green' : 'badge-gray'}>{h.pnl_settled ? 'Yes' : 'No'}</span></Td>
                </tr>
              );
            })}
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

export default function DematAccountPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userType, setUserType] = useState(() => getDefaultType(user));

  useEffect(() => {
    if (!isAdmin) return;
    setUsersLoading(true);
    api.get('/users').then(r => {
      const active = r.data.filter(u => u.is_active);
      setUsers(active);
      const self = active.find(u => u.id === user?.id);
      setSelectedUser(self || active[0] || null);
    }).catch(console.error).finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin || !users.length) return;
    const typeDef = USER_TYPES.find(t => t.label === userType);
    const filtered = typeDef ? users.filter(typeDef.filter) : users;
    const self = filtered.find(u => u.id === user?.id);
    setSelectedUser(self || filtered[0] || null);
  }, [userType, users]);

  const typeDef = USER_TYPES.find(t => t.label === userType);
  const filteredUsers = isAdmin ? (typeDef ? users.filter(typeDef.filter) : users) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
            <Landmark size={20} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Demat Account</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {isAdmin ? 'View any user\'s demat holdings · read only' : 'Your personal demat holdings'}
            </p>
          </div>
        </div>
        {isAdmin && !usersLoading && (
          <div className="flex items-center gap-2">
            <select className="input w-36" value={userType} onChange={e => setUserType(e.target.value)}>
              {USER_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
            </select>
            <select className="input w-52" value={selectedUser?.id || ''}
              onChange={e => setSelectedUser(filteredUsers.find(u => u.id === parseInt(e.target.value)))}>
              {!filteredUsers.length && <option value="">No users</option>}
              {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {isAdmin
        ? selectedUser
          ? <DematContent key={selectedUser.id} userId={selectedUser.id} />
          : <p className="text-gray-400 text-sm">No user selected.</p>
        : <DematContent userId="me" />
      }
    </div>
  );
}
