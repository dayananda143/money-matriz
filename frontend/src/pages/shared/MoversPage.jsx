import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';

function HoldersModal({ symbol, stockName, onClose }) {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/dashboard/movers/holders?symbol=${symbol}`)
      .then(r => setHolders(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{symbol}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{stockName} · Clients holding this stock</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {loading && <div className="py-8 text-center text-sm text-gray-400">Loading...</div>}
          {!loading && holders.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No open positions found.</div>}
          {holders.map(h => (
            <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-sm flex-shrink-0">
                {h.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{h.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {fmt.number(h.quantity, 2)} shares · {fmt.currency(h.current_price)}/share
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{fmt.currency(h.market_value)}</p>
                <p className={`text-xs font-medium mt-0.5 ${pnlColor(h.pnl)}`}>
                  {pnlSign(h.pnl)}{fmt.currency(Math.abs(h.pnl))} ({pnlSign(h.pnl_percent)}{fmt.percent(Math.abs(h.pnl_percent))})
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoverCard({ item, isGainer, rank, onClick }) {
  const accent   = isGainer ? 'border-green-500' : 'border-red-500';
  const badgeBg  = isGainer ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  const pctCls   = isGainer ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
  const change   = parseFloat(item.change);
  const changePct = parseFloat(item.change_percent);

  return (
    <div onClick={onClick} className={`flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 ${accent} cursor-pointer`}>
      <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 shrink-0">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-gray-900 dark:text-white text-sm">{item.symbol}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeBg}`}>
            {pnlSign(changePct)}{fmt.percent(Math.abs(changePct))}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{item.stock_name}</p>
        <p className="text-xs text-gray-400 mt-1">
          {fmt.number(item.total_quantity, 2)} shares · {fmt.currency(item.current_price)}/share
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${pctCls}`}>{pnlSign(change)}{fmt.currency(Math.abs(change))}/share</p>
        <p className="text-xs text-gray-400 mt-0.5">{fmt.currency(item.market_value)} held</p>
      </div>
    </div>
  );
}

function Section({ title, items, isGainer, emptyMsg, limit, onSelect }) {
  const Icon      = isGainer ? TrendingUp : TrendingDown;
  const iconColor = isGainer ? 'text-green-500' : 'text-red-500';
  const titleCls  = isGainer ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const headerBg  = isGainer ? 'from-green-50 dark:from-green-900/20' : 'from-red-50 dark:from-red-900/20';
  const visible   = items.slice(0, limit);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className={`px-5 py-4 bg-gradient-to-r ${headerBg} to-transparent border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5`}>
        <Icon size={16} className={iconColor} />
        <h3 className={`text-sm font-bold ${titleCls}`}>{title}</h3>
        <span className="ml-auto text-xs text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
          {Math.min(items.length, limit)} / {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">{emptyMsg}</p>
      ) : (
        <div className="p-3 space-y-2">
          {visible.map((item, i) => (
            <MoverCard key={item.symbol} item={item} isGainer={isGainer} rank={i + 1} onClick={() => onSelect(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MoversPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(5);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/dashboard/movers')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const gainers = data?.gainers ?? [];
  const losers  = data?.losers  ?? [];
  const flat    = data?.flat    ?? [];

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Today's Movers</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Based on your open positions · price change from previous close</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
            {[5, 10, 15, 20].map(n => (
              <button key={n} onClick={() => setLimit(n)}
                className={`px-3 py-1.5 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[0, 1].map(col => (
            <div key={col} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 w-24" />
              </div>
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded h-4 w-4" />
                    <div className="flex-1 space-y-2">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded h-3 w-20" />
                      <div className="bg-gray-200 dark:bg-gray-700 rounded h-3 w-32" />
                    </div>
                    <div className="bg-gray-200 dark:bg-gray-700 rounded h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && gainers.length === 0 && losers.length === 0 && flat.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-20 text-center text-gray-400">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium text-gray-600 dark:text-gray-300">No open positions found</p>
          <p className="text-sm mt-1">Add trades to see movers.</p>
        </div>
      )}

      {!loading && gainers.length === 0 && losers.length === 0 && flat.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-14 text-center text-gray-400">
          <p className="text-3xl mb-3">〰️</p>
          <p className="font-medium text-gray-600 dark:text-gray-300">No price change today</p>
          <p className="text-sm mt-1">Prices haven't been updated yet. Check back during market hours.</p>
        </div>
      )}

      {!loading && (gainers.length > 0 || losers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section title="Top Gainers" items={gainers} isGainer={true}  emptyMsg="No gainers in this period" limit={limit} onSelect={setSelected} />
          <Section title="Top Losers"  items={losers}  isGainer={false} emptyMsg="No losers in this period"  limit={limit} onSelect={setSelected} />
        </div>
      )}

      {selected && (
        <HoldersModal
          symbol={selected.symbol}
          stockName={selected.stock_name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
