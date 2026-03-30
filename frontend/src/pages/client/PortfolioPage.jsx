import { useEffect, useState } from 'react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16',
  '#14b8a6', '#a855f7', '#ef4444', '#0ea5e9',
];

function AllocationChart({ holdings, cash }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const cashVal = parseFloat(cash || 0);
  const items = holdings
    .sort((a, b) => parseFloat(b.current_value) - parseFloat(a.current_value))
    .map((h, i) => ({ symbol: h.symbol, value: parseFloat(h.current_value), color: COLORS[i % COLORS.length] }));

  if (cashVal > 0) items.push({ symbol: 'CASH', value: cashVal, color: '#6b7280' });

  const total = items.reduce((s, d) => s + d.value, 0);
  const active = activeIndex !== null ? items[activeIndex] : null;

  if (!items.length) return null;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Allocation</h3>
      <div className="flex gap-5 items-center">
        {/* Donut */}
        <div className="relative shrink-0 w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" cx="50%" cy="50%"
                innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}>
                {items.map((d, i) => (
                  <Cell key={i} fill={d.color}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            {active ? (
              <>
                <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight">{active.symbol}</p>
                <p className="text-sm font-bold leading-tight" style={{ color: active.color }}>
                  {total > 0 ? (Math.round(active.value / total * 1000) / 10) : 0}%
                </p>
                <p className="text-[9px] text-gray-400 leading-tight">{fmt.currency(active.value)}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-gray-400">Total</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt.currency(total)}</p>
              </>
            )}
          </div>
        </div>

        {/* 2-col legend */}
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {items.map((d, i) => (
            <div key={d.symbol}
              className="flex items-center gap-1.5 cursor-default rounded-md px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1, transition: 'opacity 0.15s' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{d.symbol}</span>
              <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                {total > 0 ? (Math.round(d.value / total * 1000) / 10) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectorChart({ holdings }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const sectorMap = {};
  holdings.forEach(h => {
    const sector = h.sector || 'Other';
    sectorMap[sector] = (sectorMap[sector] || 0) + parseFloat(h.current_value);
  });

  const items = Object.entries(sectorMap)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, value], i) => ({ symbol: sector, value, color: COLORS[i % COLORS.length] }));

  const total = items.reduce((s, d) => s + d.value, 0);
  const active = activeIndex !== null ? items[activeIndex] : null;

  if (!items.length) return null;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Sector Allocation</h3>
      <div className="flex gap-5 items-center">
        <div className="relative shrink-0 w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" cx="50%" cy="50%"
                innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}>
                {items.map((d, i) => (
                  <Cell key={i} fill={d.color}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            {active ? (
              <>
                <p className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight truncate w-full px-1">{active.symbol}</p>
                <p className="text-sm font-bold leading-tight" style={{ color: active.color }}>
                  {total > 0 ? (Math.round(active.value / total * 1000) / 10) : 0}%
                </p>
                <p className="text-[9px] text-gray-400 leading-tight">{fmt.currency(active.value)}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-gray-400">Sectors</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{items.length}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {items.map((d, i) => (
            <div key={d.symbol}
              className="flex items-center gap-1.5 cursor-default rounded-md px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1, transition: 'opacity 0.15s' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{d.symbol}</span>
              <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                {total > 0 ? (Math.round(d.value / total * 1000) / 10) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CAP_COLORS = {
  'Large Cap': '#3b82f6',
  'Mid Cap': '#10b981',
  'Small Cap': '#f59e0b',
  'Micro Cap': '#8b5cf6',
  'Unclassified': '#6b7280',
};

function MarketCapChart({ holdings }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const capMap = {};
  holdings.forEach(h => {
    const cap = h.market_cap_category || 'Unclassified';
    capMap[cap] = (capMap[cap] || 0) + parseFloat(h.quantity) * parseFloat(h.avg_buy_price);
  });

  const items = Object.entries(capMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cap, value]) => ({ symbol: cap, value, color: CAP_COLORS[cap] || '#06b6d4' }));

  const total = items.reduce((s, d) => s + d.value, 0);
  const active = activeIndex !== null ? items[activeIndex] : null;

  if (!items.length) return null;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Market Cap Allocation</h3>
      <div className="flex gap-5 items-center">
        <div className="relative shrink-0 w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" cx="50%" cy="50%"
                innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}>
                {items.map((d, i) => (
                  <Cell key={i} fill={d.color}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            {active ? (
              <>
                <p className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight truncate w-full px-1">{active.symbol}</p>
                <p className="text-sm font-bold leading-tight" style={{ color: active.color }}>
                  {total > 0 ? (Math.round(active.value / total * 1000) / 10) : 0}%
                </p>
                <p className="text-[9px] text-gray-400 leading-tight">{fmt.currency(active.value)}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-gray-400">Cap Mix</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{items.length}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-1 gap-y-1.5">
          {items.map((d, i) => (
            <div key={d.symbol}
              className="flex items-center gap-1.5 cursor-default rounded-md px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1, transition: 'opacity 0.15s' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{d.symbol}</span>
              <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                {total > 0 ? (Math.round(d.value / total * 1000) / 10) : 0}%
              </span>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 shrink-0">{fmt.currency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZES = [5, 10, 15, 20, 25];

function SortTh({ label, col, sort, onSort }) {
  const active = sort.key === col;
  return (
    <Th>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        {label}
        <span className="flex flex-col leading-none">
          <span className={`text-[8px] ${active && sort.dir === 'asc' ? 'text-brand-600' : 'text-gray-300 dark:text-gray-600'}`}>▲</span>
          <span className={`text-[8px] ${active && sort.dir === 'desc' ? 'text-brand-600' : 'text-gray-300 dark:text-gray-600'}`}>▼</span>
        </span>
      </button>
    </Th>
  );
}

function HoldingsDetail({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [patHolding, setPatHolding] = useState(null);
  const [patTab, setPatTab] = useState('pat');
  const [sort, setSort] = useState({ key: 'current_value', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  const handleSort = (col) => {
    setSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  useEffect(() => {
    setLoading(true);
    setData(null);
    api.get(`/portfolio/${userId}/summary`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="space-y-4">
      <SkeletonStatCards count={6} />
      <SkeletonTable rows={6} cols={9} />
    </div>
  );

  const active = data?.holdings?.filter(h => h.status === 'active') || [];
  const exited = data?.holdings?.filter(h => h.status === 'exited') || [];
  const realizedPnl = exited.reduce((s, h) => s + parseFloat(h.realized_pnl), 0);
  const activeInvested = active.reduce((s, h) => s + parseFloat(h.current_value) - parseFloat(h.unrealized_pnl), 0);
  const activeValue = active.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const activeUnrealizedPnl = activeValue - activeInvested;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">SIP Amount</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.sip_net_invested)}</p>
          <p className="text-xs text-gray-400 mt-1">Total SIP deposits</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Amount Invested</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(activeInvested)}</p>
          <p className="text-xs text-gray-400 mt-1">Cost basis (active)</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Portfolio Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.portfolio_value)}</p>
          <p className="text-xs text-gray-400 mt-1">Active holdings</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Cash Balance</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.cash_balance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Unrealized P&L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(activeUnrealizedPnl)}`}>
            {pnlSign(activeUnrealizedPnl)}{fmt.currency(activeUnrealizedPnl)}
          </p>
          <p className={`text-xs mt-1 ${pnlColor(activeInvested > 0 ? activeUnrealizedPnl / activeInvested * 100 : 0)}`}>
            {pnlSign(activeInvested > 0 ? activeUnrealizedPnl / activeInvested * 100 : 0)}{fmt.percent(Math.abs(activeInvested > 0 ? activeUnrealizedPnl / activeInvested * 100 : 0))}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Realized P&L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(realizedPnl)}`}>
            {pnlSign(realizedPnl)}{fmt.currency(realizedPnl)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Exited positions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AllocationChart holdings={active} cash={data?.cash_balance} />
        <SectorChart holdings={active} />
        <MarketCapChart holdings={active} />
      </div>

      {(() => {
        const rows = (tab === 'active' ? active : exited).filter(h => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return h.symbol?.toLowerCase().includes(q) || h.stock_name?.toLowerCase().includes(q);
        });
        const sorted = [...rows].sort((a, b) => {
          let av, bv;
          if (sort.key === 'symbol') { av = a.symbol; bv = b.symbol; }
          else if (sort.key === 'pnl_percent') { av = parseFloat(a.pnl_percent); bv = parseFloat(b.pnl_percent); }
          else if (sort.key === 'exited_pct') {
            const ba = parseFloat(a.total_buy_amount); const bb = parseFloat(b.total_buy_amount);
            av = ba > 0 ? parseFloat(a.realized_pnl) / ba * 100 : 0;
            bv = bb > 0 ? parseFloat(b.realized_pnl) / bb * 100 : 0;
          }
          else { av = parseFloat(a[sort.key] || 0); bv = parseFloat(b[sort.key] || 0); }
          if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
          return sort.dir === 'asc' ? av - bv : bv - av;
        });
        const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
        const paged = sorted.slice((page - 1) * limit, page * limit);

        return (
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                <button onClick={() => { setTab('active'); setPage(1); setSort({ key: 'current_value', dir: 'desc' }); }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  Active <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{active.length}</span>
                </button>
                <button onClick={() => { setTab('exited'); setPage(1); setSort({ key: 'realized_pnl', dir: 'desc' }); }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'exited' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  Exited <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{exited.length}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stock…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
                  {PAGE_SIZES.map(n => (
                    <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                      className={`px-2.5 py-1 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {tab === 'active' ? (
              <Table>
                <thead><tr>
                  <SortTh label="Symbol" col="symbol" sort={sort} onSort={handleSort} />
                  <Th>Name</Th><Th>Sector</Th>
                  <SortTh label="Qty" col="quantity" sort={sort} onSort={handleSort} />
                  <SortTh label="Avg Buy" col="avg_buy_price" sort={sort} onSort={handleSort} />
                  <SortTh label="Current Price" col="current_price" sort={sort} onSort={handleSort} />
                  <SortTh label="Current Value" col="current_value" sort={sort} onSort={handleSort} />
                  <SortTh label="P&L" col="unrealized_pnl" sort={sort} onSort={handleSort} />
                  <SortTh label="P&L %" col="pnl_percent" sort={sort} onSort={handleSort} />
                </tr></thead>
                <tbody>
                  {!paged.length && <EmptyRow cols={9} message="No active holdings" />}
                  {paged.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <Td><span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span></Td>
                      <Td>{h.stock_name}</Td>
                      <Td>
                        <span className="badge-blue">{h.sector || '—'}</span>
                        {h.market_cap_category && <span className="badge-purple ml-1">{h.market_cap_category}</span>}
                      </Td>
                      <Td>{fmt.number(h.quantity, 2)}</Td>
                      <Td>{fmt.currency(h.avg_buy_price)}</Td>
                      <Td>{fmt.currency(h.current_price)}</Td>
                      <Td className="font-medium">{fmt.currency(h.current_value)}</Td>
                      <Td><span className={pnlColor(h.unrealized_pnl)}>{pnlSign(h.unrealized_pnl)}{fmt.currency(h.unrealized_pnl)}</span></Td>
                      <Td><span className={pnlColor(h.pnl_percent)}>{pnlSign(h.pnl_percent)}{fmt.percent(h.pnl_percent)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Table>
                <thead><tr>
                  <SortTh label="Symbol" col="symbol" sort={sort} onSort={handleSort} />
                  <Th>Name</Th><Th>Sector</Th>
                  <SortTh label="Shares" col="total_bought_quantity" sort={sort} onSort={handleSort} />
                  <SortTh label="Avg Buy" col="avg_buy_price" sort={sort} onSort={handleSort} />
                  <SortTh label="Amt Invested" col="total_buy_amount" sort={sort} onSort={handleSort} />
                  <SortTh label="Realized P&L" col="realized_pnl" sort={sort} onSort={handleSort} />
                  <SortTh label="P&L %" col="exited_pct" sort={sort} onSort={handleSort} />
                </tr></thead>
                <tbody>
                  {!paged.length && <EmptyRow cols={8} message="No exited positions" />}
                  {paged.map(h => {
                    const buyAmt = parseFloat(h.total_buy_amount);
                    const pct = buyAmt > 0 ? (parseFloat(h.realized_pnl) / buyAmt * 100) : 0;
                    return (
                      <tr key={h.id} onClick={() => { setPatHolding(h); setPatTab('pat'); }} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                        <Td><span className="font-bold text-gray-500 dark:text-gray-400">{h.symbol}</span></Td>
                        <Td>{h.stock_name}</Td>
                        <Td>
                          <span className="badge-blue">{h.sector || '—'}</span>
                          {h.market_cap_category && <span className="badge-purple ml-1">{h.market_cap_category}</span>}
                        </Td>
                        <Td>{fmt.number(h.total_bought_quantity, 2)}</Td>
                        <Td>{fmt.currency(h.avg_buy_price)}</Td>
                        <Td>{fmt.currency(h.total_buy_amount)}</Td>
                        <Td><span className={pnlColor(h.realized_pnl)}>{pnlSign(h.realized_pnl)}{fmt.currency(h.realized_pnl)}</span></Td>
                        <Td><span className={pnlColor(pct)}>{pnlSign(pct)}{fmt.percent(pct)}</span></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} />
                  </button>
                  {(() => {
                    const range = []; for (let i = 1; i <= totalPages; i++) if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
                    const out = []; let prev = null;
                    for (const p of range) { if (prev !== null && p - prev > 1) out.push('...' + p); out.push(p); prev = p; }
                    return out.map((p, i) => typeof p === 'string'
                      ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                      : <button key={p} onClick={() => setPage(p)}
                          className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p}</button>
                    );
                  })()}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <Modal open={!!patHolding} onClose={() => setPatHolding(null)} title={patHolding ? `${patHolding.symbol} — ${patHolding.stock_name}` : ''}>
        {patHolding && (() => {
          const pnl = parseFloat(patHolding.realized_pnl || 0);
          const brokerage = parseFloat(patHolding.total_sell_brokerage || 0);
          const netProfit = pnl - brokerage;
          const days = patHolding.first_buy_date
            ? Math.floor(((patHolding.last_sell_date ? new Date(patHolding.last_sell_date) : new Date()) - new Date(patHolding.first_buy_date)) / 86400000)
            : 0;
          const taxRate = days > 365 ? 0.125 : 0.20;
          const tax = netProfit > 0 ? netProfit * taxRate : 0;
          const pat = netProfit > 0 ? netProfit - tax : 0;
          const shareholderTaking = pat * 0.30;
          const companyTaking = pat * 0.70;
          const investedAmount = parseFloat(patHolding.total_buy_amount || 0);
          const settlement = pnl >= 0
            ? investedAmount + shareholderTaking
            : investedAmount + pnl - brokerage;

          return (
            <div className="space-y-4">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {['pat', 'settlement'].map(t => (
                  <button key={t} onClick={() => setPatTab(t)}
                    className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${patTab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {t === 'pat' ? 'PAT' : 'Settlement'}
                  </button>
                ))}
              </div>

              {patTab === 'pat' ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Realized P/L</span>
                    <span className={`font-medium ${pnlColor(pnl)}`}>{pnlSign(pnl)}{fmt.currency(pnl)}</span>
                  </div>
                  {brokerage > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-sm text-gray-500">Brokerage</span>
                      <span className="font-medium text-red-500">−{fmt.currency(brokerage)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Tax ({days > 365 ? 'LTCG 12.5%' : 'STCG 20%'})</span>
                    <span className="font-medium text-red-500">−{fmt.currency(tax)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">PAT</span>
                    <span className={`font-bold ${pnlColor(pat)}`}>{fmt.currency(pat)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Your Share <span className="text-xs text-gray-400">(30%)</span></span>
                    <span className="font-semibold text-blue-600">{fmt.currency(shareholderTaking)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Company Share <span className="text-xs text-gray-400">(70%)</span></span>
                    <span className="font-semibold text-purple-600">{fmt.currency(companyTaking)}</span>
                  </div>
                  <p className="text-xs text-gray-400 pt-1">{days} days held · {days > 365 ? 'Long-term' : 'Short-term'} capital gain</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pnl >= 0 ? (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500">Invested Amount</span>
                        <span className="font-medium text-gray-900 dark:text-white">{fmt.currency(investedAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Your Share <span className="text-xs text-gray-400">(30% of PAT)</span></span>
                        <span className="font-semibold text-blue-600">+{fmt.currency(shareholderTaking)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t-2 border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Total Settlement</span>
                        <span className="text-xl font-bold text-green-600">{fmt.currency(settlement)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500">Invested Amount</span>
                        <span className="font-medium text-gray-900 dark:text-white">{fmt.currency(investedAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500">P/L (Loss)</span>
                        <span className="font-medium text-red-500">{fmt.currency(pnl)}</span>
                      </div>
                      {brokerage > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm text-gray-500">Brokerage</span>
                          <span className="font-medium text-red-500">−{fmt.currency(brokerage)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-t-2 border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Total Settlement</span>
                        <span className={`text-xl font-bold ${pnlColor(settlement)}`}>{fmt.currency(settlement)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button onClick={() => setPatHolding(null)} className="btn-secondary w-full">Close</button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

const USER_TYPES = [
  { label: 'Employee', filter: u => u.role === 'admin' || u.role === 'super_admin' },
  { label: 'Shareholder', filter: u => u.user_type === 'shareholder' },
  { label: 'Client', filter: u => u.user_type === 'client' },
];

function getDefaultType(u) {
  if (u?.user_type === 'shareholder') return 'Shareholder';
  if (u?.user_type === 'client') return 'Client';
  return 'Employee';
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userType, setUserType] = useState(() => getDefaultType(user));

  useEffect(() => {
    if (!isAdmin) return;
    setUsersLoading(true);
    api.get('/users').then(r => {
      const active = r.data.filter(u => u.is_active);
      setUsers(active);
      // Default to own account
      const self = active.find(u => u.id === user?.id);
      setSelectedUser(self || active[0] || null);
    }).catch(console.error).finally(() => setUsersLoading(false));
  }, []);

  // When type changes, try to keep self selected; otherwise pick first of that type
  useEffect(() => {
    if (!isAdmin || !users.length) return;
    const typeDef = USER_TYPES.find(t => t.label === userType);
    const filtered = typeDef ? users.filter(typeDef.filter) : users;
    const self = filtered.find(u => u.id === user?.id);
    setSelectedUser(self || filtered[0] || null);
  }, [userType, users]);

  if (isAdmin) {
    const typeDef = USER_TYPES.find(t => t.label === userType);
    const filteredUsers = typeDef ? users.filter(typeDef.filter) : users;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio</h1>
            <p className="text-gray-500 text-sm mt-1">View any user's portfolio</p>
          </div>
          {!usersLoading && (
            <div className="flex items-center gap-2">
              <select className="input w-36" value={userType} onChange={e => setUserType(e.target.value)}>
                {USER_TYPES.map(t => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
              <select className="input w-52" value={selectedUser?.id || ''} onChange={e => setSelectedUser(filteredUsers.find(u => u.id === parseInt(e.target.value)))}>
                {!filteredUsers.length && <option value="">No users</option>}
                {filteredUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}{u.id === user?.id ? ' (me)' : ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {selectedUser && <HoldingsDetail userId={selectedUser.id} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Portfolio</h1>
        <p className="text-gray-500 text-sm mt-1">Detailed holdings breakdown</p>
      </div>
      <HoldingsDetail userId="me" />
    </div>
  );
}
