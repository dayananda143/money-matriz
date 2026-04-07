import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonSearchBar, SkeletonTable } from '../../components/ui/Skeleton';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [schemeTab, setSchemeTab] = useState('All');
  const [statusTab, setStatusTab] = useState('active');

  useEffect(() => {
    api.get('/relationships/shareholder/me')
      .then(r => setClients(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const schemes = useMemo(() => {
    const set = new Set();
    clients.forEach(c => {
      if (c.scheme) c.scheme.split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
    });
    return ['All', ...Array.from(set).sort()];
  }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = !search.trim() ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchScheme = schemeTab === 'All' ||
        (c.scheme && c.scheme.split(',').map(s => s.trim()).includes(schemeTab));
      const matchStatus = statusTab === 'active' ? c.is_active : !c.is_active;
      return matchSearch && matchScheme && matchStatus;
    });
  }, [clients, search, schemeTab, statusTab]);

  const totalPages = Math.ceil(filtered.length / limit);
  const paged = filtered.slice((page - 1) * limit, page * limit);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonSearchBar />
      <SkeletonTable rows={8} cols={7} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Clients</h1>
        <p className="text-gray-500 text-sm mt-1">{clients.length} clients assigned to you</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {schemes.map(s => (
          <button key={s} onClick={() => { setSchemeTab(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${schemeTab === s ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
            {s.replace(/_/g, ' ')}
            <span className={`ml-1.5 text-xs ${schemeTab === s ? 'text-brand-200' : 'text-gray-400'}`}>
              {s === 'All' ? clients.length : clients.filter(c => c.scheme && c.scheme.split(',').map(x => x.trim()).includes(s)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex items-center gap-1 py-1">
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
          <div className="flex items-center gap-3 mb-1">
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
                placeholder="Search clients…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Scheme</Th>
              <Th>Cash Balance</Th>
              <Th>Portfolio Value</Th>
              <Th>Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {!paged.length && <EmptyRow cols={7} message="No clients found" />}
            {paged.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>
                  <Link to={`/clients/${c.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                    {c.name}
                  </Link>
                  <p className="text-xs text-gray-400">{c.phone || ''}</p>
                </Td>
                <Td className="text-gray-500 text-sm">{c.email}</Td>
                <Td>
                  {c.scheme ? c.scheme.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 text-xs rounded bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300">{s}</span>
                  )) : <span className="text-gray-400">—</span>}
                </Td>
                <Td>{fmt.currency(c.cash_balance)}</Td>
                <Td>{fmt.currency(c.portfolio_value)}</Td>
                <Td className="font-medium">{fmt.currency(parseFloat(c.cash_balance) + parseFloat(c.portfolio_value))}</Td>
                <Td><span className={c.is_active ? 'badge-green' : 'badge-red'}>{c.is_active ? 'Active' : 'Inactive'}</span></Td>
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
    </div>
  );
}
