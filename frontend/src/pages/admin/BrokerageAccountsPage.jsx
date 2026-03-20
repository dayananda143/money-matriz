import { useEffect, useState } from 'react';
import { Briefcase, ChevronRight, TrendingUp, Users, CheckCircle2, Clock, ArrowLeft } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';

function StatusDot({ settled }) {
  return settled
    ? <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle2 size={11} /> Settled</span>
    : <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400"><Clock size={11} /> Open</span>;
}

export default function BrokerageAccountsPage() {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHolder, setSelectedHolder] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    api.get('/stocks/brokerage-accounts/holders')
      .then(r => setHolders(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectHolder = (holder) => {
    setSelectedHolder(holder);
    setGroupsLoading(true);
    api.get(`/stocks/brokerage-accounts/holder/${holder.id}`)
      .then(r => setGroups(r.data))
      .catch(console.error)
      .finally(() => setGroupsLoading(false));
  };

  // Summary stats per stock (group rows for same stock)
  const stockMap = groups.reduce((acc, g) => {
    if (!acc[g.stock_id]) acc[g.stock_id] = { stock_id: g.stock_id, symbol: g.symbol, stock_name: g.stock_name, sector: g.sector, current_price: g.current_price, is_active: g.is_active, groups: [] };
    acc[g.stock_id].groups.push(g);
    return acc;
  }, {});
  const stocks = Object.values(stockMap);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {selectedHolder && (
          <button onClick={() => { setSelectedHolder(null); setGroups([]); }}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Briefcase size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {selectedHolder ? `${selectedHolder.name}'s Account` : 'Brokerage Accounts'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selectedHolder
              ? `${selectedHolder.email} · ${selectedHolder.user_type}`
              : 'Stockholders assigned to transaction groups'}
          </p>
        </div>
      </div>

      {!selectedHolder ? (
        /* Holder list */
        loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : holders.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No brokerage accounts found. Assign stockholders to transaction groups first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {holders.map(h => (
              <button key={h.id} onClick={() => selectHolder(h)}
                className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-sm transition-all text-left group">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-sm flex-shrink-0">
                  {h.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{h.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{h.email} · <span className="capitalize">{h.user_type}</span></p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{h.stock_count}</p>
                    <p className="text-xs text-gray-400">stocks</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{h.group_count}</p>
                    <p className="text-xs text-gray-400">transactions</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        /* Stock detail for selected holder */
        groupsLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : stocks.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No stocks found for this account.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stocks.map(s => {
              const totalInvested = s.groups.reduce((sum, g) => sum + parseFloat(g.total_invested || 0), 0);
              const totalBought = s.groups.reduce((sum, g) => sum + parseFloat(g.total_bought || 0), 0);
              const totalSold = s.groups.reduce((sum, g) => sum + parseFloat(g.total_sold || 0), 0);
              const totalSellAmt = s.groups.reduce((sum, g) => sum + parseFloat(g.total_sell_amount || 0), 0);
              const currentVal = (totalBought - totalSold) * parseFloat(s.current_price || 0);
              const pnl = currentVal - (totalInvested - totalSellAmt);
              const allSettled = s.groups.every(g => g.investment_settled && g.pnl_settled);

              return (
                <div key={s.stock_id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  {/* Stock header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-600 dark:text-brand-400">{s.symbol}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{s.stock_name}</span>
                        {s.sector && <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">{s.sector}</span>}
                        {allSettled && <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">All Settled</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Current price: {fmt.currency(s.current_price)}</p>
                    </div>
                    <div className="ml-auto flex gap-4 text-right text-xs">
                      <div>
                        <p className="text-gray-400">Invested</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{fmt.currency(totalInvested)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Current Value</p>
                        <p className={`font-semibold ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{fmt.currency(currentVal > 0 ? currentVal : totalSellAmt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction groups */}
                  <Table>
                    <thead>
                      <tr>
                        <Th>Transaction</Th>
                        <Th>Investors</Th>
                        <Th>Shares Bought</Th>
                        <Th>Shares Sold</Th>
                        <Th>Total Invested</Th>
                        <Th>Sell Amount</Th>
                        <Th>First Buy</Th>
                        <Th>Investment</Th>
                        <Th>P&amp;L</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.groups.map(g => (
                        <tr key={g.group_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <Td><span className="font-medium text-gray-900 dark:text-white">{g.group_label}</span></Td>
                          <Td><span className="flex items-center gap-1"><Users size={12} className="text-gray-400" />{g.investor_count}</span></Td>
                          <Td>{fmt.number(g.total_bought, 2)}</Td>
                          <Td>{fmt.number(g.total_sold, 2)}</Td>
                          <Td>{fmt.currency(g.total_invested)}</Td>
                          <Td>{parseFloat(g.total_sell_amount) > 0 ? fmt.currency(g.total_sell_amount) : '—'}</Td>
                          <Td className="text-xs text-gray-500">{g.first_buy_date ? fmt.date(g.first_buy_date) : '—'}</Td>
                          <Td><StatusDot settled={g.investment_settled} /></Td>
                          <Td><StatusDot settled={g.pnl_settled} /></Td>
                        </tr>
                      ))}
                      {s.groups.length > 1 && (
                        <tr className="bg-gray-50 dark:bg-gray-800/60 font-semibold text-xs border-t-2 border-gray-200 dark:border-gray-600">
                          <Td className="text-gray-500">Total</Td>
                          <Td></Td>
                          <Td>{fmt.number(s.groups.reduce((sum,g) => sum + parseFloat(g.total_bought||0), 0), 2)}</Td>
                          <Td>{fmt.number(s.groups.reduce((sum,g) => sum + parseFloat(g.total_sold||0), 0), 2)}</Td>
                          <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(totalInvested)}</Td>
                          <Td className="font-bold text-gray-900 dark:text-white">{totalSellAmt > 0 ? fmt.currency(totalSellAmt) : '—'}</Td>
                          <Td colSpan={3}></Td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
