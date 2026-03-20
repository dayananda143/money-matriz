import { useEffect, useState } from 'react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';

const COLORS = ['#22c55e','#3b82f6','#a855f7','#f97316','#ef4444','#eab308','#06b6d4','#ec4899'];

function HoldingsDetail({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [patHolding, setPatHolding] = useState(null);
  const [patTab, setPatTab] = useState('pat');

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
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={6} cols={9} />
    </div>
  );

  const active = data?.holdings?.filter(h => h.status === 'active') || [];
  const exited = data?.holdings?.filter(h => h.status === 'exited') || [];
  const pieData = active.map(h => ({ name: h.symbol, value: parseFloat(h.current_value) }));
  const realizedPnl = exited.reduce((s, h) => s + parseFloat(h.realized_pnl), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Portfolio Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.portfolio_value)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Cash Balance</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.cash_balance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Unrealized P&L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(data?.portfolio_value - data?.invested)}`}>
            {pnlSign(data?.portfolio_value - data?.invested)}{fmt.currency(data?.portfolio_value - data?.invested)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Realized P&L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(realizedPnl)}`}>
            {pnlSign(realizedPnl)}{fmt.currency(realizedPnl)}
          </p>
        </div>
      </div>

      {pieData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Allocation</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt.currency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            <button onClick={() => setTab('active')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              Active <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{active.length}</span>
            </button>
            <button onClick={() => setTab('exited')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'exited' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              Exited <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{exited.length}</span>
            </button>
          </div>
        </div>
        {tab === 'active' ? (
          <Table>
            <thead><tr>
              <Th>Symbol</Th><Th>Name</Th><Th>Sector</Th><Th>Qty</Th>
              <Th>Avg Buy</Th><Th>Current Price</Th><Th>Current Value</Th><Th>P&amp;L</Th><Th>P&amp;L %</Th>
            </tr></thead>
            <tbody>
              {!active.length && <EmptyRow cols={9} message="No active holdings" />}
              {active.map(h => (
                <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td><span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span></Td>
                  <Td>{h.stock_name}</Td>
                  <Td><span className="badge-blue">{h.sector || '—'}</span></Td>
                  <Td>{fmt.number(h.quantity, 4)}</Td>
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
              <Th>Symbol</Th><Th>Name</Th><Th>Sector</Th><Th>Shares Held</Th>
              <Th>Avg Buy</Th><Th>Amount Invested</Th><Th>Realized P&amp;L</Th><Th>P&amp;L %</Th>
            </tr></thead>
            <tbody>
              {!exited.length && <EmptyRow cols={8} message="No exited positions" />}
              {exited.map(h => {
                const buyAmt = parseFloat(h.total_buy_amount);
                const pct = buyAmt > 0 ? (parseFloat(h.realized_pnl) / buyAmt * 100) : 0;
                return (
                  <tr key={h.id} onClick={() => { setPatHolding(h); setPatTab('pat'); }} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                    <Td><span className="font-bold text-gray-500 dark:text-gray-400">{h.symbol}</span></Td>
                    <Td>{h.stock_name}</Td>
                    <Td><span className="badge-blue">{h.sector || '—'}</span></Td>
                    <Td>{fmt.number(h.total_bought_quantity, 4)}</Td>
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
      </div>

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

export default function PortfolioPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setUsersLoading(true);
    api.get('/users').then(r => {
      const clients = r.data.filter(u => u.is_active);
      setUsers(clients);
      if (clients.length) setSelectedUser(clients[0]);
    }).catch(console.error).finally(() => setUsersLoading(false));
  }, []);

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio</h1>
            <p className="text-gray-500 text-sm mt-1">View any client or shareholder's portfolio</p>
          </div>
          {!usersLoading && (
            <select className="input w-64" value={selectedUser?.id || ''} onChange={e => setSelectedUser(users.find(u => u.id === parseInt(e.target.value)))}>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.user_type})</option>
              ))}
            </select>
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
