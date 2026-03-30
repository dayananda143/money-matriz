import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { SkeletonPageHeader, SkeletonStatCards } from '../../components/ui/Skeleton';
import HoldingsWidget from '../../components/shared/HoldingsWidget';

export default function ShareholderDashboard() {
  const { user } = useAuth();
  const [allClients, setAllClients] = useState([]);
  const [demat, setDemat] = useState([]);
  const [sipNet, setSipNet] = useState(0);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/relationships/all-clients?scope=all'),
      api.get('/stocks/my-demat'),
      api.get('/dashboard/shareholder'),
      api.get('/portfolio/me/summary'),
    ]).then(([c, d, s, p]) => {
      setAllClients(c.data);
      setDemat(d.data);
      setSipNet(parseFloat(s.data?.sip_net_invested || 0));
      setPortfolio(p.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonStatCards count={4} />
    </div>
  );

  const activeHoldings = demat.filter(h => parseFloat(h.total_bought) - parseFloat(h.total_sold) > 0);
  const totalInvested = activeHoldings.reduce((s, h) => s + parseFloat(h.total_invested), 0);
  const totalCurrentValue = activeHoldings.reduce((s, h) => {
    const rem = parseFloat(h.total_bought) - parseFloat(h.total_sold);
    return s + rem * parseFloat(h.current_price);
  }, 0);
  const unrealizedPnl = totalCurrentValue - totalInvested;
  const pnlPct = totalInvested > 0 ? unrealizedPnl / totalInvested * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your portfolio and clients</p>
      </div>

      {/* My Portfolio */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">My Portfolio</p>
          <Link to="/demat" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View Demat Account →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">SIP Net Invested</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(sipNet)}</p>
            <p className="text-xs text-gray-400 mt-1">Total SIP deployed</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Invested</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalInvested)}</p>
            <p className="text-xs text-gray-400 mt-1">Active holdings cost</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Value</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalCurrentValue)}</p>
            <p className="text-xs text-gray-400 mt-1">{activeHoldings.length} active stocks</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Unrealized P&amp;L</p>
            <p className={`text-xl font-bold mt-1 ${pnlColor(unrealizedPnl)}`}>{pnlSign(unrealizedPnl)}{fmt.currency(unrealizedPnl)}</p>
            {totalInvested > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(pnlPct)}`}>{pnlSign(pnlPct)}{fmt.percent(Math.abs(pnlPct))}</p>}
          </div>
        </div>
      </div>

      {/* Clients Summary */}
      {(() => {
        const activeClients = allClients.filter(c => c.is_active);
        const clientsGiven      = activeClients.reduce((s, c) => s + parseFloat(c.total_deposited || 0), 0);
        const clientsInvested   = activeClients.reduce((s, c) => s + parseFloat(c.active_invested || 0), 0);
        const clientsRealized   = activeClients.reduce((s, c) => s + parseFloat(c.realized_pnl || 0), 0);
        const clientsUnrealized = activeClients.reduce((s, c) => s + parseFloat(c.unrealized_pnl || 0), 0);
        return (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Clients Summary</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Given</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(clientsGiven)}</p>
                <p className="text-xs text-gray-400 mt-1">Deposits − withdrawals</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Invested</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(clientsInvested)}</p>
                <p className="text-xs text-gray-400 mt-1">Active holdings cost</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Realized P&amp;L</p>
                <p className={`text-xl font-bold mt-1 ${pnlColor(clientsRealized)}`}>{pnlSign(clientsRealized)}{fmt.currency(clientsRealized)}</p>
                {clientsGiven > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(clientsRealized)}`}>{pnlSign(clientsRealized)}{fmt.percent(Math.abs(clientsRealized / clientsGiven * 100))} of given</p>}
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Unrealized P&amp;L</p>
                <p className={`text-xl font-bold mt-1 ${pnlColor(clientsUnrealized)}`}>{pnlSign(clientsUnrealized)}{fmt.currency(clientsUnrealized)}</p>
                {clientsInvested > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(clientsUnrealized)}`}>{pnlSign(clientsUnrealized)}{fmt.percent(Math.abs(clientsUnrealized / clientsInvested * 100))} of invested</p>}
              </div>
            </div>
          </div>
        );
      })()}

      <HoldingsWidget holdings={portfolio?.holdings} />

    </div>
  );
}
