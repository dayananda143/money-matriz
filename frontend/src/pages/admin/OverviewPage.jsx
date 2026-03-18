import { useEffect, useState } from 'react';
import { Users, TrendingUp, Wallet, BarChart2, ArrowLeftRight, Search } from 'lucide-react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/overview'),
      api.get('/dashboard/all-users'),
    ]).then(([ov, us]) => {
      setData(ov.data);
      setUsers(us.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={6} cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />
      <SkeletonTable rows={8} cols={9} />
    </div>
  );

  const filtered = users.filter(u => {
    const matchType = typeFilter === 'all' || u.user_type === typeFilter;
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Platform-wide statistics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard title="Total Clients" value={data?.total_clients ?? 0} icon={Users} color="brand" />
        <StatCard title="Total Shareholders" value={data?.total_shareholders ?? 0} icon={Users} color="blue" />
        <StatCard title="Active Stocks" value={data?.total_stocks ?? 0} icon={BarChart2} color="purple" />
        <StatCard title="Total Cash AUM" value={fmt.currency(data?.total_cash_aum)} icon={Wallet} color="orange" />
        <StatCard title="Portfolio AUM" value={fmt.currency(data?.total_portfolio_aum)} icon={TrendingUp} color="brand" />
        <StatCard title="30-day Volume" value={fmt.currency(data?.monthly_tx_volume)} sub={`${data?.monthly_tx_count} transactions`} icon={ArrowLeftRight} color="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Total AUM</h3>
          <p className="text-3xl font-bold text-brand-600">{fmt.currency((data?.total_cash_aum || 0) + (data?.total_portfolio_aum || 0))}</p>
          <p className="text-sm text-gray-500 mt-1">Cash + Portfolio combined</p>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">This Month</h3>
          <p className="text-3xl font-bold text-blue-600">{data?.monthly_tx_count ?? 0} trades</p>
          <p className="text-sm text-gray-500 mt-1">Worth {fmt.currency(data?.monthly_tx_volume)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Clients & Shareholders</h2>
          <p className="text-sm text-gray-500">{filtered.length} of {users.length}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all', 'client', 'shareholder'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${typeFilter === t ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Manager</Th>
                <Th>Cash Balance</Th>
                <Th>Portfolio Value</Th>
                <Th>Total Value</Th>
                <Th>Invested</Th>
                <Th>Unrealized P&amp;L</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length && <EmptyRow cols={9} message="No users found" />}
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td>
                    <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </Td>
                  <Td><span className={u.user_type === 'shareholder' ? 'badge-blue' : 'badge-gray'}>{u.user_type}</span></Td>
                  <Td className="text-gray-500 text-xs">{u.shareholder_name || '—'}</Td>
                  <Td>{fmt.currency(u.cash_balance)}</Td>
                  <Td className="font-medium">{fmt.currency(u.portfolio_value)}</Td>
                  <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(u.total_value)}</Td>
                  <Td>{fmt.currency(u.total_invested)}</Td>
                  <Td><span className={pnlColor(u.unrealized_pnl)}>{pnlSign(u.unrealized_pnl)}{fmt.currency(u.unrealized_pnl)}</span></Td>
                  <Td><span className={u.is_active ? 'badge-green' : 'badge-red'}>{u.is_active ? 'Active' : 'Inactive'}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
