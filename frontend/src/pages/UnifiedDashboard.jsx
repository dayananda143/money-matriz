import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Wallet, BarChart2, ArrowUpDown, Mail, Phone, Tag, UserCheck, Calendar, Landmark, Users, Building2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { fmt, pnlColor, pnlSign } from '../utils/format';
import StatCard from '../components/ui/StatCard';
import { SkeletonStatCards, SkeletonTable } from '../components/ui/Skeleton';
import { Table, Th, Td, EmptyRow } from '../components/ui/Table';
import HoldingsWidget from '../components/shared/HoldingsWidget';

const SECTOR_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'];

// ── Widget: Profile ────────────────────────────────────────────────────────
function ProfileWidget({ user }) {
  const schemes = user?.scheme ? user.scheme.split(',').map(s => s.trim()).filter(Boolean) : [];
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-xl flex-shrink-0">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{user?.name}</h2>
            <span className={user?.is_active ? 'badge-green' : 'badge-red'}>{user?.is_active ? 'Active' : 'Inactive'}</span>
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
              <div className="flex items-center gap-2 sm:col-span-2">
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
  );
}

// ── Widget: My Portfolio Stats ─────────────────────────────────────────────
function MyPortfolioWidget({ portfolioData }) {
  if (!portfolioData) return <SkeletonStatCards count={4} />;
  // Match Portfolio page: use active holdings cost basis, not summary `invested` field
  const activeHoldings = (portfolioData.holdings || []).filter(h => h.status === 'active');
  const exitedHoldings = (portfolioData.holdings || []).filter(h => h.status === 'exited');
  const activeInvested = activeHoldings.reduce((s, h) => s + parseFloat(h.quantity) * parseFloat(h.avg_buy_price), 0);
  const realizedPnl = exitedHoldings.reduce((s, h) => s + parseFloat(h.realized_pnl || 0), 0);
  const pnl = (portfolioData.portfolio_value || 0) - activeInvested;
  const pnlPct = activeInvested > 0 ? pnl / activeInvested * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">My Portfolio</p>
        <Link to="/portfolio" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View Portfolio →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard title="Portfolio Value" value={fmt.currency(portfolioData.portfolio_value)} icon={TrendingUp} color="brand" />
        <StatCard title="Cash Balance" value={fmt.currency(portfolioData.cash_balance)} icon={Wallet} color="blue" />
        <StatCard title="Amount Invested" value={fmt.currency(activeInvested)} icon={BarChart2} color="purple" />
        <StatCard title="Unrealized P&L" value={`${pnlSign(pnl)}${fmt.currency(pnl)}`} trend={pnlPct} icon={ArrowUpDown} color="orange" />
        <StatCard title="Realized P&L" value={`${pnlSign(realizedPnl)}${fmt.currency(realizedPnl)}`} icon={ArrowUpDown} color={realizedPnl >= 0 ? 'brand' : 'orange'} />
      </div>
    </div>
  );
}

// ── Widget: Sector Distribution ────────────────────────────────────────────
function SectorWidget({ holdings }) {
  const activeHoldings = (holdings || []).filter(h => parseFloat(h.quantity) > 0);
  if (!activeHoldings.length) return null;
  const sectorMap = {};
  activeHoldings.forEach(h => { const s = h.sector || 'Other'; sectorMap[s] = (sectorMap[s] || 0) + parseFloat(h.current_value); });
  const chartData = Object.entries(sectorMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
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
              <Tooltip formatter={v => fmt.currency(v)} />
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
}

// ── Widget: Recent Fund Movements ──────────────────────────────────────────
function RecentFundsWidget() {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/portfolio/me/funds').then(r => setFunds(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="card p-4 animate-pulse h-32" />;
  return (
    <div className="card">
      <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-white">Recent Fund Movements</h2>
        <Link to="/funds" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
      </div>
      <Table>
        <thead><tr><Th>Date</Th><Th>Type</Th><Th>Amount</Th><Th>Notes</Th></tr></thead>
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
  );
}

// ── Widget: Demat Account Summary ──────────────────────────────────────────
function DematWidget() {
  const [demat, setDemat] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/stocks/my-demat').then(r => setDemat(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);
  if (loading) return <SkeletonStatCards count={3} />;
  const active = demat.filter(h => parseFloat(h.total_bought) - parseFloat(h.total_sold) > 0);
  const invested = active.reduce((s, h) => s + parseFloat(h.total_invested), 0);
  const currentValue = active.reduce((s, h) => {
    const rem = parseFloat(h.total_bought) - parseFloat(h.total_sold);
    return s + rem * parseFloat(h.current_price);
  }, 0);
  const pnl = currentValue - invested;
  const pnlPct = invested > 0 ? pnl / invested * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">My Demat Account</p>
        <Link to="/demat" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View Demat Account →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Invested</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(invested)}</p>
          <p className="text-xs text-gray-400 mt-1">Active holdings cost</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Current Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(currentValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{active.length} active stocks</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Unrealized P&amp;L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(pnl)}`}>{pnlSign(pnl)}{fmt.currency(pnl)}</p>
          {invested > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(pnlPct)}`}>{pnlSign(pnlPct)}{fmt.percent(Math.abs(pnlPct))}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Widget: Clients Summary ────────────────────────────────────────────────
function ClientsSummaryWidget() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/relationships/all-clients?scope=all').then(r => setClients(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);
  if (loading) return <SkeletonStatCards count={4} />;
  const active = clients.filter(c => c.is_active);
  const given      = active.reduce((s, c) => s + parseFloat(c.total_deposited || 0), 0);
  const invested   = active.reduce((s, c) => s + parseFloat(c.active_invested || 0), 0);
  const realized   = active.reduce((s, c) => s + parseFloat(c.realized_pnl || 0), 0);
  const unrealized = active.reduce((s, c) => s + parseFloat(c.unrealized_pnl || 0), 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Clients Summary <span className="normal-case font-normal text-gray-400">({active.length} active)</span>
        </p>
        <Link to="/clients/dashboard" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View Clients →</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Given</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(given)}</p>
          <p className="text-xs text-gray-400 mt-1">Deposits − withdrawals</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Invested</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(invested)}</p>
          <p className="text-xs text-gray-400 mt-1">Active holdings cost</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Realized P&amp;L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(realized)}`}>{pnlSign(realized)}{fmt.currency(realized)}</p>
          {given > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(realized)}`}>{pnlSign(realized)}{fmt.percent(Math.abs(realized / given * 100))} of given</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Unrealized P&amp;L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(unrealized)}`}>{pnlSign(unrealized)}{fmt.currency(unrealized)}</p>
          {invested > 0 && <p className={`text-xs font-medium mt-1 ${pnlColor(unrealized)}`}>{pnlSign(unrealized)}{fmt.percent(Math.abs(unrealized / invested * 100))} of invested</p>}
        </div>
      </div>
    </div>
  );
}

// ── Widget: Company Snapshot ───────────────────────────────────────────────
function CompanySnapshotWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/company/dashboard').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);
  if (loading) return <SkeletonStatCards count={4} />;
  const { shares, debt, deposits = { principal: 0, bank_value: 0 }, stock_strategy_pnl, trading_investment_total, categories = {} } = data;
  const totalInvestment = shares?.by_type?.reduce((s, t) => s + t.total, 0) ?? 0;
  const totalExpenses = (debt?.paid || 0)
    + Math.abs(stock_strategy_pnl?.net ?? categories['stock_strategy']?.total ?? 0)
    + (trading_investment_total ?? categories['trading_investment']?.total ?? 0)
    + ['operating_expense', 'tax', 'clients_payment'].reduce((s, k) => s + (categories[k]?.total || 0), 0);
  const cashOnHand = totalInvestment - totalExpenses - deposits.principal;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Company Overview</p>
        <Link to="/company/dashboard" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Full Dashboard →</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Investment</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalInvestment)}</p>
          <p className="text-xs text-gray-400 mt-1">Shareholder funds</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalExpenses)}</p>
          <p className="text-xs text-gray-400 mt-1">All categories</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Cash on Hand</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(cashOnHand)}`}>{fmt.currency(cashOnHand)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Bank Deposits</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(deposits.bank_value)}</p>
          <p className="text-xs text-gray-400 mt-1">Principal: {fmt.currency(deposits.principal)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Widget registry ────────────────────────────────────────────────────────
const WIDGETS = [
  {
    id: 'profile',
    roles: ['client'],
    render: ({ user }) => <ProfileWidget user={user} />,
  },
  {
    id: 'portfolio',
    roles: ['client', 'shareholder', 'admin'],
    render: ({ portfolioData }) => <MyPortfolioWidget portfolioData={portfolioData} />,
  },
  {
    id: 'company',
    roles: ['shareholder', 'admin'],
    render: () => <CompanySnapshotWidget />,
  },
  {
    id: 'clients',
    roles: ['shareholder', 'admin'],
    render: () => <ClientsSummaryWidget />,
  },
  {
    id: 'demat',
    roles: ['shareholder', 'admin'],
    render: () => <DematWidget />,
  },
  {
    id: 'sector',
    roles: ['client', 'shareholder'],
    render: ({ holdings }) => <SectorWidget holdings={holdings} />,
  },
  {
    id: 'holdings',
    roles: ['client', 'shareholder'],
    render: ({ holdings, sipNet }) => <HoldingsWidget holdings={holdings} sipNet={sipNet} />,
  },
  {
    id: 'funds',
    roles: ['client'],
    render: () => <RecentFundsWidget />,
  },
];

// ── Unified Dashboard ──────────────────────────────────────────────────────
export default function UnifiedDashboard() {
  const { user } = useAuth();
  const [portfolioData, setPortfolioData] = useState(null);
  const [sipNet, setSipNet] = useState(0);
  const [loading, setLoading] = useState(true);

  const isShareholder = user?.user_type === 'shareholder';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const role = isAdmin ? 'admin' : isShareholder ? 'shareholder' : 'client';

  useEffect(() => {
    const calls = [api.get('/portfolio/me/summary')];
    if (isShareholder || isAdmin) calls.push(api.get('/dashboard/shareholder'));
    Promise.all(calls).then(([p, s]) => {
      setPortfolioData(p.data);
      if (s) setSipNet(parseFloat(s.data?.sip_net_invested || 0));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const visibleWidgets = WIDGETS.filter(w => w.roles.includes(role));
  const holdings = portfolioData?.holdings || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {role === 'client' ? 'Your investment overview' : role === 'shareholder' ? 'Overview of your portfolio and clients' : 'Full platform overview'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <SkeletonStatCards count={4} />
          <SkeletonStatCards count={4} />
        </div>
      ) : (
        visibleWidgets.map(w => (
          <div key={w.id}>
            {w.render({ user, portfolioData, holdings, sipNet })}
          </div>
        ))
      )}
    </div>
  );
}
