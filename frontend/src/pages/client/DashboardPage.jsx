import { useEffect, useState } from 'react';
import { TrendingUp, Wallet, BarChart2, ArrowUpDown, User, Mail, Phone, Tag, UserCheck, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import HoldingsWidget from '../../components/shared/HoldingsWidget';

const SECTOR_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#a855f7',
];

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/portfolio/me/summary'),
      api.get('/portfolio/me/funds'),
    ]).then(([p, f]) => {
      setData(p.data);
      setFunds(f.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={5} cols={6} />
    </div>
  );

  const pnlPct = data?.invested > 0
    ? ((data.portfolio_value - data.invested) / data.invested * 100)
    : 0;

  const schemes = user?.scheme
    ? user.scheme.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your investment overview</p>
      </div>

      {/* Profile Card */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-xl flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{user?.name}</h2>
              <span className={user?.is_active ? 'badge-green' : 'badge-red'}>
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Mail size={14} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              {user?.manager_name && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <UserCheck size={14} className="text-gray-400 flex-shrink-0" />
                  <span>{user.manager_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                <span>Joined {fmt.date(user?.created_at)}</span>
              </div>
              {schemes.length > 0 && (
                <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
                  <Tag size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {schemes.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Portfolio Value" value={fmt.currency(data?.portfolio_value)} icon={TrendingUp} color="brand" />
        <StatCard title="Cash Balance" value={fmt.currency(data?.cash_balance)} icon={Wallet} color="blue" />
        <StatCard title="Total Invested" value={fmt.currency(data?.invested)} icon={BarChart2} color="purple" />
        <StatCard
          title="Unrealized P&L"
          value={`${pnlSign(data?.portfolio_value - data?.invested)}${fmt.currency(data?.portfolio_value - data?.invested)}`}
          trend={pnlPct}
          icon={ArrowUpDown}
          color="orange"
        />
      </div>

      {/* Sector Distribution */}
      {(() => {
        const activeHoldings = (data?.holdings || []).filter(h => parseFloat(h.quantity) > 0);
        if (activeHoldings.length === 0) return null;
        const sectorMap = {};
        activeHoldings.forEach(h => {
          const s = h.sector || 'Other';
          sectorMap[s] = (sectorMap[s] || 0) + parseFloat(h.current_value);
        });
        const chartData = Object.entries(sectorMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
        const total = chartData.reduce((s, d) => s + d.value, 0);
        return (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Sector Distribution</h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-full sm:w-64 h-64 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                      {chartData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt.currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-2">
                {chartData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-sm">
                      <span className="text-gray-900 dark:text-white font-medium">{fmt.currency(d.value)}</span>
                      <span className="text-gray-400 w-12 text-right">{((d.value / total) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Holdings Treemap */}
      <HoldingsWidget holdings={data?.holdings} />
      <div className="flex justify-end -mt-4">
        <Link to="/portfolio" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View full portfolio →</Link>
      </div>

      {/* Recent Fund Movements */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Recent Fund Movements</h2>
          <Link to="/funds" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {!funds.length && <EmptyRow cols={4} message="No fund movements yet" />}
            {funds.slice(0, 5).map(f => (
              <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>{fmt.date(f.executed_at)}</Td>
                <Td><span className={f.type === 'deposit' ? 'badge-green' : 'badge-red'}>{f.type.toUpperCase()}</span></Td>
                <Td className="font-medium">{fmt.currency(f.amount)}</Td>
                <Td className="text-gray-500 text-xs">{f.notes || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
