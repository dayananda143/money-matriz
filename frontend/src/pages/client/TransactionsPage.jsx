import { useEffect, useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonTable } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';

function SortTh({ label, col, sort, onSort }) {
  const active = sort.key === col;
  return (
    <Th>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 transition-colors whitespace-nowrap">
        {label}
        <span className={`text-xs ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-300 dark:text-gray-600'}`}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}
        </span>
      </button>
    </Th>
  );
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState({ key: 'executed_at', dir: 'desc' });

  const handleSort = (col) => {
    setSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  useEffect(() => {
    const url = isAdmin
      ? '/portfolio/all/transactions?limit=500'
      : '/portfolio/me/transactions?limit=500';
    api.get(url)
      .then(r => setTxs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return txs
      .filter(t => filter === 'all' || t.type === filter)
      .filter(t => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (t.symbol || '').toLowerCase().includes(q) ||
          (t.stock_name || '').toLowerCase().includes(q) ||
          (t.user_name || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q)
        );
      });
  }, [txs, filter, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const av = a[sort.key] ?? '';
    const bv = b[sort.key] ?? '';
    const numA = parseFloat(av), numB = parseFloat(bv);
    const isNum = !isNaN(numA) && !isNaN(numB);
    const cmp = isNum ? numA - numB : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  }), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paginated = sorted.slice((page - 1) * limit, page * limit);

  const colCount = isAdmin ? 9 : 8;

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={8} cols={colCount} />
    </div>
  );

  const paginationRange = () => {
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
    }
    const withEllipsis = [];
    let prev = null;
    for (const p of range) {
      if (prev !== null && p - prev > 1) withEllipsis.push('...' + p);
      withEllipsis.push(p);
      prev = p;
    }
    return withEllipsis;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isAdmin ? 'All platform transactions' : 'All buy / sell activity'}
        </p>
      </div>

      <div className="card">
        {/* Header: tabs + controls */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            {[
              { key: 'all',  label: 'All',  count: txs.length },
              { key: 'buy',  label: 'Buy',  count: txs.filter(t => t.type === 'buy').length },
              { key: 'sell', label: 'Sell', count: txs.filter(t => t.type === 'sell').length },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setFilter(tab.key); setPage(1); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${filter === tab.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === tab.key ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-1 pr-2">
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
                className="pl-8 pr-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
                placeholder="Search stock, investor…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <SortTh label="Date" col="executed_at" sort={sort} onSort={handleSort} />
              <SortTh label="Type" col="type" sort={sort} onSort={handleSort} />
              <SortTh label="Stock" col="symbol" sort={sort} onSort={handleSort} />
              {isAdmin && <SortTh label="Investor" col="user_name" sort={sort} onSort={handleSort} />}
              <SortTh label="Qty" col="quantity" sort={sort} onSort={handleSort} />
              <SortTh label="Price" col="price" sort={sort} onSort={handleSort} />
              <SortTh label="Total" col="total" sort={sort} onSort={handleSort} />
              <SortTh label="Executed By" col="executed_by_name" sort={sort} onSort={handleSort} />
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {!paginated.length && <EmptyRow cols={colCount} message="No transactions found" />}
            {paginated.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>{fmt.datetime(t.executed_at)}</Td>
                <Td>
                  <span className={t.type === 'buy' ? 'badge-green' : 'badge-red'}>
                    {t.type.toUpperCase()}
                  </span>
                </Td>
                <Td>
                  <span className="font-medium">{t.symbol}</span>
                  <span className="text-gray-400 text-xs ml-1">{t.stock_name}</span>
                </Td>
                {isAdmin && (
                  <Td>
                    <p className="font-medium text-gray-900 dark:text-white">{t.user_name}</p>
                    <p className="text-xs text-gray-400">{t.user_type}</p>
                  </Td>
                )}
                <Td>{fmt.number(t.quantity, 2)}</Td>
                <Td>{fmt.currency(t.price)}</Td>
                <Td className="font-medium">{fmt.currency(t.total)}</Td>
                <Td className="text-gray-500">{t.executed_by_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{t.notes || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {totalPages > 1 && (
          <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={14} />
              </button>
              {paginationRange().map((p, i) =>
                typeof p === 'string'
                  ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                  : <button key={p} onClick={() => setPage(p)}
                      className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      {p}
                    </button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
