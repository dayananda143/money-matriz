import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Landmark, Receipt, TrendingUp, FileText, BarChart2, CreditCard, PieChart as PieIcon, Building2, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../../api';
import { fmt } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import { SkeletonPageHeader, SkeletonStatCards } from '../../components/ui/Skeleton';

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#14b8a6','#f97316','#8b5cf6','#84cc16','#06b6d4','#e11d48','#a3e635','#fb923c','#a855f7'];

const CATEGORY_META = {
  debt:               { label: 'Debt',                icon: Landmark,   color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20',       to: '/company/debt' },
  operating_expense:  { label: 'Operating Expense',   icon: Receipt,    color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', to: '/company/operating-expense' },
  stock_strategy:     { label: 'Stock Strategy',      icon: TrendingUp, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/20',    to: '/company/stock-strategy' },
  tax:                { label: 'Tax',                 icon: FileText,   color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', to: '/company/tax' },
  trading_investment: { label: 'Trading Investment',  icon: BarChart2,  color: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-900/20',      to: '/company/trading-investment' },
  clients_payment:    { label: 'Clients Payment',     icon: CreditCard, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', to: '/company/clients-payment' },
  shares:             { label: 'Shares',              icon: PieIcon,    color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20', to: '/company/shares' },
};

const CATEGORY_ORDER = ['debt','operating_expense','stock_strategy','tax','trading_investment','clients_payment','shares'];

export default function CompanyDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSlice, setActiveSlice] = useState(null);

  useEffect(() => {
    api.get('/company/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      <SkeletonStatCards count={3} cols="grid-cols-1 sm:grid-cols-3" />
    </div>
  );

  const { categories = {}, debt, shares, recent = [], stock_strategy_pnl, trading_investment_total, deposits = { principal: 0, bank_value: 0, interest: 0, count: 0 } } = data;

  const totalInvestment = shares.by_type?.reduce((s, t) => s + t.total, 0) ?? 0;
  const totalExpenses = debt.paid
    + Math.abs(stock_strategy_pnl?.net ?? categories['stock_strategy']?.total ?? 0)
    + (trading_investment_total ?? categories['trading_investment']?.total ?? 0)
    + CATEGORY_ORDER.filter(k => k !== 'debt' && k !== 'shares' && k !== 'stock_strategy' && k !== 'trading_investment')
        .reduce((s, k) => s + (categories[k]?.total || 0), 0);
  const cashOnHand = totalInvestment - totalExpenses - deposits.principal;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of all company finances and investments</p>
        </div>
      </div>

      {/* Overall Financials */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Overall Financials</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Total Company Investment" value={fmt.currency(totalInvestment)} icon={Wallet} color="purple" />
          <StatCard title="Total Expenses" value={fmt.currency(totalExpenses)} icon={Receipt} color="orange" />
          <StatCard title="Cash on Hand" value={fmt.currency(cashOnHand)} icon={Wallet} color="brand" />
          <StatCard
            title="Bank Deposits"
            value={fmt.currency(deposits.bank_value)}
            sub={`Principal: ${fmt.currency(deposits.principal)}${deposits.interest !== 0 ? `  ·  ${deposits.interest >= 0 ? '+' : ''}${fmt.currency(deposits.interest)} interest` : ''}`}
            icon={Building2}
            color="teal"
          />
        </div>
      </div>

      {/* All categories */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Expense Breakdown</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {/* Debt Remaining first */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[0] }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Debt Payments Made</p>
              <p className="text-xs text-gray-400">{categories['debt']?.count ?? 0} record{(categories['debt']?.count ?? 0) !== 1 ? 's' : ''}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmt.currency(debt.paid)}</p>
            </div>
          </div>
          {CATEGORY_ORDER.filter(k => k !== 'debt' && k !== 'shares').map((key, i) => {
            const meta = CATEGORY_META[key];
            const cat = categories[key] || { total: 0, count: 0 };
            const displayAmount = key === 'stock_strategy' && stock_strategy_pnl != null
              ? stock_strategy_pnl.net
              : key === 'trading_investment' && trading_investment_total != null
                ? trading_investment_total
                : cat.total;
            const catTotal = CATEGORY_ORDER.filter(k => k !== 'debt' && k !== 'shares').reduce((s, k) => {
              const amt = k === 'stock_strategy' && stock_strategy_pnl != null
                ? stock_strategy_pnl.net
                : k === 'trading_investment' && trading_investment_total != null
                  ? trading_investment_total
                  : (categories[k]?.total || 0);
              return s + amt;
            }, 0);
            const pct = catTotal > 0 ? ((displayAmount / catTotal) * 100).toFixed(1) : '0.0';
            return (
              <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[(i + 1) % COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{meta.label}</p>
                  <p className="text-xs text-gray-400">{cat.count} record{cat.count !== 1 ? 's' : ''}{key === 'stock_strategy' ? ' · Net P&L' : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${key === 'stock_strategy' ? (displayAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-gray-900 dark:text-white'}`}>{key === 'stock_strategy' ? fmt.currency(Math.abs(displayAmount)) : fmt.currency(displayAmount)}</p>
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shares by category */}
      {shares.by_type?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Shares by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {shares.by_type.map((t, i) => {
              const sharesTotal = shares.by_type.reduce((s, x) => s + x.total, 0);
              const pct = sharesTotal > 0 ? ((t.total / sharesTotal) * 100).toFixed(1) : '0.0';
              return (
                <div key={t.share_type} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.share_type}</p>
                    <p className="text-xs text-gray-400">{t.count} record{t.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt.currency(t.total)}</p>
                    <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shares ownership pie */}
      {shares.breakdown.length > 0 && (() => {
        const grandTotal = shares.total_contributed;
        const chartData = shares.breakdown.map(r => ({
          name: r.name,
          value: r.total_amount,
          pct: grandTotal > 0 ? ((r.total_amount / grandTotal) * 100).toFixed(1) : '0.0',
        }));
        return (
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Shareholder Ownership</h2>
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative w-full lg:w-48 h-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={44} outerRadius={76}
                      dataKey="value" nameKey="name" paddingAngle={2}
                      onMouseEnter={(_, index) => setActiveSlice(index)}
                      onMouseLeave={() => setActiveSlice(null)}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]}
                          opacity={activeSlice === null || activeSlice === i ? 1 : 0.45} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {activeSlice !== null ? (
                    <div className="text-center px-1" style={{ maxWidth: 80 }}>
                      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 leading-tight break-words">{chartData[activeSlice].name}</p>
                      <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-0.5">{fmt.currency(chartData[activeSlice].value)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{chartData[activeSlice].pct}%</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">Total</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{fmt.currency(grandTotal)}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mb-2">
                  {chartData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 py-1.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-800 dark:text-gray-200 font-medium truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-semibold text-violet-600 dark:text-violet-400">{fmt.currency(d.value)}</span>
                        <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold px-1.5 py-0.5 rounded-full">{d.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 text-xs border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white">{fmt.currency(grandTotal)}</span>
                    <span className="font-bold text-gray-500">100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
