import { useEffect, useState } from 'react';
import { Users, TrendingUp, Wallet, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';

export default function ShareholderDashboard() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/shareholder'),
      api.get('/relationships/shareholder/me')
    ]).then(([s, c]) => {
      setStats(s.data);
      setClients(c.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your portfolio and clients</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats?.client_count ?? 0} icon={Users} color="brand" />
        <StatCard title="Clients AUM" value={fmt.currency((stats?.clients_cash_aum || 0) + (stats?.clients_portfolio_aum || 0))} icon={BarChart2} color="blue" />
        <StatCard title="Own Portfolio" value={fmt.currency(stats?.own_portfolio_value)} icon={TrendingUp} color="purple" />
        <StatCard title="Own Cash" value={fmt.currency(stats?.own_cash_balance)} icon={Wallet} color="orange" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">My Clients</h2>
          <Link to="/clients" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Cash Balance</Th>
              <Th>Portfolio Value</Th>
              <Th>Total Value</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {!clients.length && <EmptyRow cols={5} message="No clients assigned" />}
            {clients.slice(0, 8).map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>
                  <Link to={`/clients/${c.id}`} className="hover:text-brand-600">
                    <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </Link>
                </Td>
                <Td>{fmt.currency(c.cash_balance)}</Td>
                <Td>{fmt.currency(c.portfolio_value)}</Td>
                <Td className="font-medium">{fmt.currency(parseFloat(c.cash_balance) + parseFloat(c.portfolio_value))}</Td>
                <Td><span className={c.is_active ? 'badge-green' : 'badge-red'}>{c.is_active ? 'Active' : 'Inactive'}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
