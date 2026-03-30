import { useEffect, useState } from 'react';
import { Users, BarChart2 } from 'lucide-react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import { SkeletonPageHeader, SkeletonStatCards } from '../../components/ui/Skeleton';
import HoldingsWidget from '../../components/shared/HoldingsWidget';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/overview'),
      api.get('/dashboard/all-holdings'),
      api.get('/relationships/all-clients?scope=all'),
      api.get('/dashboard/all-users'),
    ]).then(([ov, h, c, u]) => {
      setData(ov.data);
      setHoldings(h.data);
      setAllClients(c.data);
      setAllUsers(u.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={6} cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Platform-wide statistics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Clients" value={data?.total_clients ?? 0} icon={Users} color="brand" />
        <StatCard title="Total Shareholders" value={data?.total_shareholders ?? 0} icon={Users} color="blue" />
        <StatCard title="Active Stocks" value={data?.total_stocks ?? 0} icon={BarChart2} color="purple" />
      </div>


      {(() => {
        const active = allClients.filter(c => c.is_active);
        const totalGiven      = active.reduce((s, c) => s + parseFloat(c.total_deposited || 0), 0);
        const totalInvested   = active.reduce((s, c) => s + parseFloat(c.active_invested || 0), 0);
        const totalRealized   = active.reduce((s, c) => s + parseFloat(c.realized_pnl || 0), 0);
        const totalUnrealized = active.reduce((s, c) => s + parseFloat(c.unrealized_pnl || 0), 0);
        return (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Clients Summary</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Given</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalGiven)}</p>
                <p className="text-xs text-gray-400 mt-1">Deposits − withdrawals</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Invested</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalInvested)}</p>
                <p className="text-xs text-gray-400 mt-1">Active holdings cost</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Realized P&amp;L</p>
                <p className={`text-xl font-bold mt-1 ${pnlColor(totalRealized)}`}>{pnlSign(totalRealized)}{fmt.currency(totalRealized)}</p>
                {totalGiven > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(totalRealized)}`}>{pnlSign(totalRealized)}{fmt.percent(Math.abs(totalRealized / totalGiven * 100))} of given</p>}
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Unrealized P&amp;L</p>
                <p className={`text-xl font-bold mt-1 ${pnlColor(totalUnrealized)}`}>{pnlSign(totalUnrealized)}{fmt.currency(totalUnrealized)}</p>
                {totalInvested > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(totalUnrealized)}`}>{pnlSign(totalUnrealized)}{fmt.percent(Math.abs(totalUnrealized / totalInvested * 100))} of invested</p>}
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const shareholders = allUsers.filter(u => u.user_type === 'shareholder' && u.is_active);
        const shInvested   = shareholders.reduce((s, u) => s + parseFloat(u.total_invested || 0), 0);
        const shValue      = shareholders.reduce((s, u) => s + parseFloat(u.portfolio_value || 0), 0);
        const shUnrealized = shareholders.reduce((s, u) => s + parseFloat(u.unrealized_pnl || 0), 0);
        const shRealized   = shareholders.reduce((s, u) => s + parseFloat(u.sh_realized_pnl || 0), 0);
        return (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Shareholders Summary</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Invested</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(shInvested)}</p>
                <p className="text-xs text-gray-400 mt-1">Active holdings cost</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Portfolio Value</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(shValue)}</p>
                <p className="text-xs text-gray-400 mt-1">{shareholders.length} shareholders</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Unrealized P&amp;L</p>
                <p className={`text-xl font-bold mt-1 ${pnlColor(shUnrealized)}`}>{pnlSign(shUnrealized)}{fmt.currency(shUnrealized)}</p>
                {shInvested > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(shUnrealized)}`}>{pnlSign(shUnrealized)}{fmt.percent(Math.abs(shUnrealized / shInvested * 100))} of invested</p>}
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Realized P&amp;L</p>
                <p className={`text-xl font-bold mt-1 ${pnlColor(shRealized)}`}>{pnlSign(shRealized)}{fmt.currency(shRealized)}</p>
                <p className="text-xs text-gray-400 mt-1">Exited positions</p>
              </div>
            </div>
          </div>
        );
      })()}

      <HoldingsWidget holdings={holdings} radioName="overviewHoldings" />
    </div>
  );
}
