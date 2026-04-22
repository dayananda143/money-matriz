import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import api from '../../api';
import { fmt, pnlSign } from '../../utils/format';

function IndexCard({ data }) {
  if (!data) return null;
  const up       = data.change_percent >= 0;
  const colorCls = up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
  const bgCls    = up ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  const badgeCls = up ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
  const Icon     = up ? TrendingUp : TrendingDown;

  return (
    <div className={`rounded-2xl border p-5 ${bgCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{data.short}</p>
          <p className="text-xs text-gray-400 mt-0.5">{data.label}</p>
        </div>
        <Icon size={20} className={colorCls} />
      </div>
      {data.price == null ? (
        <p className="text-sm text-gray-400 mt-3">Unavailable</p>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-3">
            {data.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-semibold ${colorCls}`}>
              {pnlSign(data.change)}{Math.abs(data.change).toFixed(2)}
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${badgeCls}`}>
              {pnlSign(data.change_percent)}{Math.abs(data.change_percent).toFixed(2)}%
            </span>
          </div>
          {data.previous_close != null && (
            <p className="text-xs text-gray-400 mt-1">Prev close: {data.previous_close.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          )}
        </>
      )}
    </div>
  );
}

function MoverCard({ item, isGainer, rank }) {
  const colorCls = isGainer ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
  const bgBadge  = isGainer ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
  const accent   = isGainer ? 'border-l-green-500' : 'border-l-red-500';

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 border-l-4 ${accent}`}>
      <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 shrink-0">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-gray-900 dark:text-white text-sm">{item.symbol}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${bgBadge}`}>
            {pnlSign(item.change_percent)}{Math.abs(item.change_percent).toFixed(2)}%
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{item.stock_name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${colorCls}`}>
          {pnlSign(item.change)}{fmt.currency(Math.abs(item.change))}/share
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{fmt.currency(item.current_price)}</p>
      </div>
    </div>
  );
}

function MoversSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map(i => (
        <div key={i} className="animate-pulse flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function TodaysDataPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    api.get('/dashboard/today')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Today's Data</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Live market indices and portfolio movers</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Row 1: Portfolio P&L + Indices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* P&L — spans 1 col */}
        {loading ? (
          <div className="animate-pulse rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ) : data?.portfolio && (() => {
          const { unrealized_pnl, unrealized_pnl_pct, market_value, invested } = data.portfolio;
          const up       = unrealized_pnl >= 0;
          const colorCls = up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
          const bgCls    = up ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
          const badgeCls = up ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
          return (
            <div className={`rounded-2xl border p-5 ${bgCls}`}>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unrealized P&L</p>
              <div className="flex items-end gap-3 mt-3 flex-wrap">
                <p className={`text-2xl font-bold ${colorCls}`}>
                  {pnlSign(unrealized_pnl)}{fmt.currency(Math.abs(unrealized_pnl))}
                </p>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full mb-0.5 ${badgeCls}`}>
                  {pnlSign(unrealized_pnl_pct)}{Math.abs(unrealized_pnl_pct).toFixed(2)}%
                </span>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Invested: <span className="font-medium text-gray-700 dark:text-gray-300">{fmt.currency(invested)}</span></span>
                <span>Current: <span className="font-medium text-gray-700 dark:text-gray-300">{fmt.currency(market_value)}</span></span>
              </div>
            </div>
          );
        })()}

        {/* Nifty */}
        {loading ? (
          <div className="animate-pulse rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ) : <IndexCard data={data?.indices?.nifty} />}

        {/* Sensex */}
        {loading ? (
          <div className="animate-pulse rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ) : <IndexCard data={data?.indices?.sensex} />}
      </div>

      {/* Row 2: Gainers + Losers side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top Gainers */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-green-50 dark:from-green-900/20 to-transparent border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
            <TrendingUp size={16} className="text-green-500" />
            <h3 className="text-sm font-bold text-green-700 dark:text-green-400">Top Gainers</h3>
            <span className="ml-auto text-xs text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
              Portfolio
            </span>
          </div>
          <div className="p-3">
            {loading ? <MoversSkeleton /> : data?.gainers?.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No gainers today</p>
            ) : (
              <div className="space-y-2">
                {data.gainers.map((item, i) => (
                  <MoverCard key={item.symbol} item={item} isGainer={true} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-red-50 dark:from-red-900/20 to-transparent border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
            <TrendingDown size={16} className="text-red-500" />
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400">Top Losers</h3>
            <span className="ml-auto text-xs text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
              Portfolio
            </span>
          </div>
          <div className="p-3">
            {loading ? <MoversSkeleton /> : data?.losers?.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No losers today</p>
            ) : (
              <div className="space-y-2">
                {data.losers.map((item, i) => (
                  <MoverCard key={item.symbol} item={item} isGainer={false} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
