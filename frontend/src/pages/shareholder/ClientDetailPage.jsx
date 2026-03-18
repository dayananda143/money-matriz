import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Wallet } from 'lucide-react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonFilterPills, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

export default function ClientDetailPage() {
  const { id } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [funds, setFunds] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('holdings');
  const [tradeModal, setTradeModal] = useState(false);
  const [fundModal, setFundModal] = useState(false);
  const [tradeForm, setTradeForm] = useState({ stock_id: '', type: 'buy', quantity: '', price: '', notes: '' });
  const [fundForm, setFundForm] = useState({ type: 'deposit', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/portfolio/${id}/summary`),
      api.get(`/portfolio/${id}/transactions?limit=100`),
      api.get(`/portfolio/${id}/funds`),
      api.get('/stocks')
    ]).then(([p, t, f, s]) => {
      setPortfolio(p.data);
      setTransactions(t.data);
      setFunds(f.data);
      setStocks(s.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const submitTrade = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/portfolio/${id}/trade`, { ...tradeForm, quantity: parseFloat(tradeForm.quantity), price: parseFloat(tradeForm.price) });
      setTradeModal(false); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const submitFund = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/portfolio/${id}/funds`, { ...fundForm, amount: parseFloat(fundForm.amount) });
      setFundModal(false); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} cols="grid-cols-1 sm:grid-cols-3" />
      <SkeletonFilterPills count={3} />
      <SkeletonTable rows={6} cols={7} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Client Portfolio</h1>
          <p className="text-sm text-gray-500">Detailed view and management</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setFundModal(true); setError(''); setFundForm({ type: 'deposit', amount: '', notes: '' }); }} className="btn-secondary text-sm">
            Fund Movement
          </button>
          <button onClick={() => { setTradeModal(true); setError(''); setTradeForm({ stock_id: '', type: 'buy', quantity: '', price: '', notes: '' }); }} className="btn-primary text-sm">
            + Trade
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(portfolio?.portfolio_value)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Cash Balance</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(portfolio?.cash_balance)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Unrealized P&L</p>
          <p className={`text-2xl font-bold mt-1 ${pnlColor(portfolio?.portfolio_value - portfolio?.invested)}`}>
            {pnlSign(portfolio?.portfolio_value - portfolio?.invested)}{fmt.currency(portfolio?.portfolio_value - portfolio?.invested)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {['holdings', 'transactions', 'funds'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'holdings' && (
        <div className="card">
          <Table>
            <thead><tr><Th>Symbol</Th><Th>Name</Th><Th>Qty</Th><Th>Avg Buy</Th><Th>Current</Th><Th>Value</Th><Th>P&L</Th></tr></thead>
            <tbody>
              {!portfolio?.holdings?.length && <EmptyRow cols={7} message="No holdings" />}
              {portfolio?.holdings?.map(h => (
                <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td><span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span></Td>
                  <Td>{h.stock_name}</Td>
                  <Td>{fmt.number(h.quantity, 4)}</Td>
                  <Td>{fmt.currency(h.avg_buy_price)}</Td>
                  <Td>{fmt.currency(h.current_price)}</Td>
                  <Td className="font-medium">{fmt.currency(h.current_value)}</Td>
                  <Td><span className={pnlColor(h.unrealized_pnl)}>{pnlSign(h.unrealized_pnl)}{fmt.currency(h.unrealized_pnl)} ({pnlSign(h.pnl_percent)}{fmt.percent(h.pnl_percent)})</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="card">
          <Table>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Stock</Th><Th>Qty</Th><Th>Price</Th><Th>Total</Th><Th>Notes</Th></tr></thead>
            <tbody>
              {!transactions.length && <EmptyRow cols={7} message="No transactions" />}
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td>{fmt.datetime(t.executed_at)}</Td>
                  <Td><span className={t.type === 'buy' ? 'badge-green' : 'badge-red'}>{t.type.toUpperCase()}</span></Td>
                  <Td><span className="font-medium">{t.symbol}</span></Td>
                  <Td>{fmt.number(t.quantity, 4)}</Td>
                  <Td>{fmt.currency(t.price)}</Td>
                  <Td className="font-medium">{fmt.currency(t.total)}</Td>
                  <Td className="text-gray-500 text-xs">{t.notes || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {tab === 'funds' && (
        <div className="card">
          <Table>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Amount</Th><Th>Notes</Th></tr></thead>
            <tbody>
              {!funds.length && <EmptyRow cols={4} message="No fund movements" />}
              {funds.map(f => (
                <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td>{fmt.datetime(f.executed_at)}</Td>
                  <Td><span className={f.type === 'deposit' ? 'badge-green' : 'badge-red'}>{f.type.toUpperCase()}</span></Td>
                  <Td className="font-medium">{fmt.currency(f.amount)}</Td>
                  <Td className="text-gray-500 text-xs">{f.notes || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Trade Modal */}
      <Modal open={tradeModal} onClose={() => setTradeModal(false)} title="Execute Trade">
        <form onSubmit={submitTrade} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Stock</label>
            <select className="input" value={tradeForm.stock_id} onChange={e => setTradeForm(f => ({ ...f, stock_id: e.target.value }))} required>
              <option value="">Select stock...</option>
              {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={tradeForm.type} onChange={e => setTradeForm(f => ({ ...f, type: e.target.value }))}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input type="number" className="input" placeholder="0" min="0" step="0.0001" value={tradeForm.quantity} onChange={e => setTradeForm(f => ({ ...f, quantity: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Price per Share (₹)</label>
            <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={tradeForm.price} onChange={e => setTradeForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" className="input" placeholder="Trade notes..." value={tradeForm.notes} onChange={e => setTradeForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setTradeModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Executing...' : 'Execute Trade'}</button>
          </div>
        </form>
      </Modal>

      {/* Fund Modal */}
      <Modal open={fundModal} onClose={() => setFundModal(false)} title="Fund Movement">
        <form onSubmit={submitFund} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Type</label>
            <select className="input" value={fundForm.type} onChange={e => setFundForm(f => ({ ...f, type: e.target.value }))}>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={fundForm.amount} onChange={e => setFundForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" className="input" placeholder="Notes..." value={fundForm.notes} onChange={e => setFundForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setFundModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Processing...' : 'Confirm'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
