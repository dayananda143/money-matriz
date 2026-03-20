import { useEffect, useState } from 'react';
import { TrendingUp, Wallet, BarChart2, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';

export default function ClientDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/portfolio/me/summary')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your investment overview</p>
      </div>

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

      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Holdings</h2>
          <Link to="/portfolio" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Stock</Th>
              <Th>Qty</Th>
              <Th>Avg Price</Th>
              <Th>Current</Th>
              <Th>Value</Th>
              <Th>P&L</Th>
            </tr>
          </thead>
          <tbody>
            {data?.holdings?.length === 0 && <EmptyRow cols={6} message="No holdings yet" />}
            {data?.holdings?.slice(0, 5).map(h => (
              <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{h.symbol}</p>
                    <p className="text-xs text-gray-500">{h.stock_name}</p>
                  </div>
                </Td>
                <Td>{fmt.number(h.quantity, 2)}</Td>
                <Td>{fmt.currency(h.avg_buy_price)}</Td>
                <Td>{fmt.currency(h.current_price)}</Td>
                <Td className="font-medium">{fmt.currency(h.current_value)}</Td>
                <Td>
                  <span className={pnlColor(h.unrealized_pnl)}>
                    {pnlSign(h.unrealized_pnl)}{fmt.currency(h.unrealized_pnl)} ({pnlSign(h.pnl_percent)}{fmt.percent(h.pnl_percent)})
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
