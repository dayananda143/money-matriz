import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, TrendingUp, TrendingDown, RefreshCw, Loader, ShoppingCart, Pencil, Trash2, ChevronUp, ChevronDown, X, History, MoreVertical, ArrowLeft } from 'lucide-react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const EMPTY = { symbol: '', name: '', sector: '', current_price: '', is_active: true };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const TRADE_EMPTY = { user_id: '', quantity: '', price: '', notes: '', executed_at: today() };

function AddInvestmentModal({ stock, open, onClose, onDone, groupId }) {
  const [users, setUsers] = useState([]);
  const [price, setPrice] = useState('');
  const [executedAt, setExecutedAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [selections, setSelections] = useState({});
  const [tab, setTab] = useState('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPrice(stock?.current_price ? parseFloat(stock.current_price).toFixed(2) : '');
    setExecutedAt(today());
    setNotes('');
    setSelections({});
    setTab('all');
    setError('');
    api.get('/users').then(r => setUsers(r.data.filter(u => u.is_active))).catch(console.error);
  }, [open, stock]);

  const toggle = (id) => setSelections(s => {
    const next = { ...s };
    if (next[id]) delete next[id];
    else next[id] = '';
    return next;
  });

  const setAmount = (id, val) => setSelections(s => ({ ...s, [id]: val }));

  const tabs = ['all', ...([...new Set(users.map(u => u.user_type))].sort())];
  const visibleUsers = tab === 'all' ? users : users.filter(u => u.user_type === tab);
  const selected = Object.entries(selections);
  const p = parseFloat(price) || 0;
  const totalValue = selected.reduce((s, [, a]) => s + (parseFloat(a) || 0), 0);
  const totalShares = p > 0 ? totalValue / p : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!selected.length) { setError('Select at least one investor'); return; }
    const invalid = selected.find(([, a]) => !a || parseFloat(a) <= 0);
    if (invalid) { setError('Enter investment amount for all selected investors'); return; }
    if (!p) { setError('Enter buy price first'); return; }
    setError(''); setSaving(true);
    try {
      await Promise.all(selected.map(([userId, amount]) =>
        api.post(`/portfolio/${userId}/trade`, {
          stock_id: stock.id,
          type: 'buy',
          quantity: parseFloat((parseFloat(amount) / p).toFixed(2)),
          price: p,
          total: parseFloat(parseFloat(amount).toFixed(2)),
          notes: notes || undefined,
          executed_at: executedAt || undefined,
          group_id: groupId || undefined,
        })
      ));
      onDone();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={stock ? `Add Investment — ${stock.symbol}` : ''}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Buy Price (₹)</label>
            <input type="number" className="input" min="0.01" step="0.01" value={price}
              onChange={e => setPrice(e.target.value)} required />
          </div>
          <div>
            <label className="label">Buy Date</label>
            <input type="date" className="input [color-scheme:light] dark:[color-scheme:dark]" value={executedAt}
              onChange={e => setExecutedAt(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="label">Investors & Amounts</label>
          <div className="flex gap-1 mb-2">
            {tabs.map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {t === 'all' ? `All (${users.length})` : `${t} (${users.filter(u => u.user_type === t).length})`}
              </button>
            ))}
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 max-h-52 overflow-y-auto">
            {visibleUsers.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">No users in this category</div>}
            {visibleUsers.map(u => {
              const checked = u.id in selections;
              const amount = selections[u.id] ?? '';
              const calcQty = amount && p > 0 ? (parseFloat(amount) / p).toFixed(2) : null;
              return (
                <div key={u.id} className={`flex items-center gap-3 px-3 py-2 ${checked ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(u.id)}
                    className="w-4 h-4 rounded accent-brand-600 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
                    {u.name} <span className="text-xs text-gray-400">({u.user_type})</span>
                  </span>
                  {checked && (
                    <input type="number" min="0.01" step="0.01" placeholder="Amount (₹)"
                      value={amount} onChange={e => setAmount(u.id, e.target.value)}
                      className="input w-28 py-1 text-sm" autoFocus />
                  )}
                  {checked && calcQty && (
                    <span className="text-xs text-brand-600 dark:text-brand-400 flex-shrink-0 w-20 text-right">
                      {calcQty} shares
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selected.length > 0 && price && totalValue > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400 flex justify-between">
            <span>{selected.length} investor{selected.length > 1 ? 's' : ''} · {fmt.number(totalShares, 2)} shares</span>
            <strong>{fmt.currency(totalValue)}</strong>
          </div>
        )}

        <div>
          <label className="label">Notes (optional)</label>
          <input className="input" placeholder="e.g. Initial investment" value={notes}
            onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving || !selected.length} className="btn-primary flex-1">
            {saving ? 'Adding...' : `Add${selected.length > 1 ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditHoldingModal({ stock, holder, open, onClose, onDone }) {
  const [form, setForm] = useState({ quantity: '', avg_buy_price: '', buy_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !holder) return;
    const d = holder.first_buy_date ? holder.first_buy_date.split('T')[0] : '';
    setForm({ quantity: holder.quantity, avg_buy_price: holder.avg_buy_price, buy_date: d });
    setError('');
  }, [open, holder]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await api.put(`/portfolio/${holder.id}/holding/${stock.id}`, {
        quantity: parseFloat(form.quantity),
        avg_buy_price: parseFloat(form.avg_buy_price),
        buy_date: form.buy_date || undefined,
      });
      onDone();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={holder ? `Edit Holding — ${holder.name}` : ''}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Directly update the recorded quantity and average buy price for <strong className="text-gray-700 dark:text-gray-200">{holder?.name}</strong> in <strong className="text-gray-700 dark:text-gray-200">{stock?.symbol}</strong>.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity (Shares)</label>
            <input type="number" className="input" min="0" step="0.01" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Avg Buy Price (₹)</label>
            <input type="number" className="input" min="0" step="0.01" value={form.avg_buy_price}
              onChange={e => setForm(f => ({ ...f, avg_buy_price: e.target.value }))} required />
          </div>
          <div className="col-span-2">
            <label className="label">Buy Date</label>
            <input type="date" className="input [color-scheme:light] dark:[color-scheme:dark]" value={form.buy_date}
              onChange={e => setForm(f => ({ ...f, buy_date: e.target.value }))} />
          </div>
        </div>
        {form.quantity && form.avg_buy_price && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
            Total invested value: <strong>{fmt.currency(parseFloat(form.quantity) * parseFloat(form.avg_buy_price))}</strong>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SellModal({ stock, holder, open, onClose, onDone, groupId }) {
  const [form, setForm] = useState({ quantity: '', price: '', brokerage: '', notes: '', executed_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !holder || !stock) return;
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    setForm({ quantity: '', price: stock.current_price ? parseFloat(stock.current_price).toFixed(2) : '', brokerage: '', notes: '', executed_at: today });
    setError('');
  }, [open, holder, stock]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await api.post(`/portfolio/${holder.id}/trade`, {
        stock_id: stock.id,
        type: 'sell',
        quantity: parseFloat(form.quantity),
        price: parseFloat(form.price),
        brokerage: form.brokerage ? parseFloat(form.brokerage) : 0,
        notes: form.notes || undefined,
        executed_at: form.executed_at || undefined,
        group_id: groupId || undefined,
      });
      onDone();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const maxQty = parseFloat(parseFloat(holder?.quantity || 0).toFixed(2));

  return (
    <Modal open={open} onClose={onClose} title={holder ? `Sell — ${holder.name} · ${stock?.symbol}` : ''}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          Available shares: <strong className="text-gray-900 dark:text-white">{fmt.number(maxQty, 2)}</strong>
          <span className="mx-2">·</span>
          Avg buy price: <strong className="text-gray-900 dark:text-white">{fmt.currency(holder?.avg_buy_price)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity to Sell</label>
            <div className="flex gap-2">
              <input type="number" className="input" min="0.01" max={maxQty} step="0.01" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
              <button type="button" onClick={() => setForm(f => ({ ...f, quantity: parseFloat(maxQty).toFixed(2) }))}
                className="btn-secondary px-3 flex-shrink-0 text-xs whitespace-nowrap">
                Sell All
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Max: {fmt.number(maxQty, 2)}</p>
          </div>
          <div>
            <label className="label">Sell Price (₹)</label>
            <input type="number" className="input" min="0.01" step="0.01" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Sell Date</label>
            <input type="date" className="input [color-scheme:light] dark:[color-scheme:dark]" value={form.executed_at}
              onChange={e => setForm(f => ({ ...f, executed_at: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Brokerage (₹)</label>
            <input type="number" className="input" min="0" step="any" placeholder="0" value={form.brokerage}
              onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))} />
          </div>
        </div>
        {form.quantity && form.price && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-orange-700 dark:text-orange-400 space-y-1">
            <div>Sale value: <strong>{fmt.currency(parseFloat(form.quantity) * parseFloat(form.price))}</strong></div>
            <div>P&amp;L on this sale: <strong className={pnlColor(parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0))}>
              {pnlSign(parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0))}
              {fmt.currency((parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0)) * parseFloat(form.quantity))}
            </strong></div>
            {form.brokerage && parseFloat(form.brokerage) > 0 && (
              <div>After brokerage P&amp;L: <strong className={pnlColor((parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0)) * parseFloat(form.quantity) - parseFloat(form.brokerage))}>
                {fmt.currency((parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0)) * parseFloat(form.quantity) - parseFloat(form.brokerage))}
              </strong></div>
            )}
          </div>
        )}
        <div>
          <label className="label">Notes (optional)</label>
          <input className="input" placeholder="e.g. Partial exit" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-danger flex-1">{saving ? 'Selling...' : 'Confirm Sell'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SellAllModal({ stock, holders, open, onClose, onDone, groupId }) {
  const activeHolders = holders.filter(h => h.status === 'active' && parseFloat(h.quantity) > 0);
  const [form, setForm] = useState({ price: '', executed_at: '', brokerage: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !stock) return;
    setForm({ price: stock.current_price ? parseFloat(stock.current_price).toFixed(2) : '', brokerage: '', executed_at: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() });
    setError('');
  }, [open, stock]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const price = parseFloat(form.price);
      const totalBrokerage = form.brokerage ? parseFloat(form.brokerage) : 0;
      const totalSaleValue = activeHolders.reduce((s, h) => s + parseFloat(h.quantity) * price, 0);
      await Promise.all(activeHolders.map(h => {
        const holderValue = parseFloat(h.quantity) * price;
        const holderBrokerage = totalSaleValue > 0 ? totalBrokerage * (holderValue / totalSaleValue) : 0;
        return api.post(`/portfolio/${h.id}/trade`, {
          stock_id: stock.id,
          type: 'sell',
          quantity: parseFloat(h.quantity),
          price,
          brokerage: holderBrokerage,
          executed_at: form.executed_at || undefined,
          notes: 'Bulk sell all shares',
          group_id: groupId || undefined,
        });
      }));
      onDone();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const totalShares = activeHolders.reduce((s, h) => s + parseFloat(h.quantity), 0);
  const totalValue = form.price ? totalShares * parseFloat(form.price) : 0;

  return (
    <Modal open={open} onClose={onClose} title={stock ? `Sell All Shares — ${stock.symbol}` : ''}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
        {activeHolders.length === 0 ? (
          <p className="text-center py-6 text-gray-400">No active investors to sell.</p>
        ) : (
          <>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Active investors: <strong className="text-gray-900 dark:text-white">{activeHolders.length}</strong></div>
              <div>Total shares to sell: <strong className="text-gray-900 dark:text-white">{fmt.number(totalShares, 2)}</strong></div>
              {totalValue > 0 && <div>Total sale value: <strong className="text-gray-900 dark:text-white">{fmt.currency(totalValue)}</strong></div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sell Price (₹)</label>
                <input type="number" className="input" min="0.01" step="0.01" value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Sell Date</label>
                <input type="date" className="input [color-scheme:light] dark:[color-scheme:dark]" value={form.executed_at}
                  onChange={e => setForm(f => ({ ...f, executed_at: e.target.value }))} required />
              </div>
              <div className="col-span-2">
                <label className="label">Total Brokerage (₹) <span className="text-gray-400 font-normal">— split proportionally across investors</span></label>
                <input type="number" className="input" min="0" step="any" placeholder="0" value={form.brokerage}
                  onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))} />
              </div>
            </div>
            {form.brokerage && parseFloat(form.brokerage) > 0 && form.price && activeHolders.length > 0 && (
              <div className="space-y-1">
                {activeHolders.map(h => {
                  const hVal = parseFloat(h.quantity) * parseFloat(form.price);
                  const hBrok = totalValue > 0 ? parseFloat(form.brokerage) * (hVal / totalValue) : 0;
                  return (
                    <div key={h.id} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{h.name}</span>
                      <span>Brokerage: {fmt.currency(hBrok)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
              This will sell all shares for all {activeHolders.length} active investor{activeHolders.length > 1 ? 's' : ''} at the same price and date.
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-danger flex-1">
                {saving ? 'Processing...' : `Sell All — ${activeHolders.length} investor${activeHolders.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

function StockHolderModal({ stock, open, onClose, onDone }) {
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('all');
    setSearch('');
    api.get('/users').then(r => setUsers(r.data.filter(u => u.is_active))).catch(console.error);
  }, [open]);

  const tabs = ['all', ...([...new Set(users.map(u => u.user_type))].sort())];
  const visibleUsers = (tab === 'all' ? users : users.filter(u => u.user_type === tab))
    .filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const currentHolder = stock?.holder_id;

  const select = async (userId) => {
    setSaving(true);
    try {
      await api.put(`/stocks/${stock.id}/holder`, { holder_user_id: userId });
      onDone();
      onClose();
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await api.put(`/stocks/${stock.id}/holder`, { holder_user_id: null });
      onDone();
      onClose();
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={stock ? `Stock Holder — ${stock.symbol}` : ''}>
      <div className="space-y-4">
        {currentHolder && (
          <div className="flex items-center justify-between p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Current Holder</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{stock.holder_name}</p>
              <p className="text-xs text-gray-500">{stock.holder_email} · {stock.holder_user_type}</p>
            </div>
            <button onClick={clear} disabled={saving} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Remove holder">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {t === 'all' ? `All (${users.length})` : `${t} (${users.filter(u => u.user_type === t).length})`}
            </button>
          ))}
        </div>

        <input className="input text-sm" placeholder="Search by name or email…" value={search}
          onChange={e => setSearch(e.target.value)} />

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
          {visibleUsers.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">No users found</div>}
          {visibleUsers.map(u => {
            const isSelected = u.id === currentHolder;
            return (
              <button key={u.id} type="button" disabled={saving} onClick={() => select(u.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isSelected ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {u.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <span className={u.user_type === 'shareholder' ? 'badge-blue' : 'badge-gray'}>{u.user_type}</span>
                {isSelected && <UserCheck size={16} className="text-brand-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center">Click a user to assign them as the stock holder</p>
      </div>
    </Modal>
  );
}

const holdingPeriod = (startStr, endStr) => {
  if (!startStr) return '—';
  const end = endStr ? new Date(endStr) : new Date();
  const days = Math.floor((end - new Date(startStr)) / 86400000);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months}m ${days % 30}d`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}y ${remMonths}m` : `${years}y`;
};

export function HoldersModal({ stock, open, onClose, onEdit, onReload, showToast, fullPage = false }) {
  const [holders, setHolders] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [sellAllOpen, setSellAllOpen] = useState(false);
  const [editHolder, setEditHolder] = useState(null);
  const [sellHolder, setSellHolder] = useState(null);
  const [deleteHolder, setDeleteHolder] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [investmentSettled, setInvestmentSettled] = useState(false);
  const [pnlSettled, setPnlSettled] = useState(false);
  const [brokerageList, setBrokerageList] = useState([]);
  const [newBrokerage, setNewBrokerage] = useState('');
  const [patHolder, setPatHolder] = useState(null);
  const [txnHolder, setTxnHolder] = useState(null);
  const [txnHistory, setTxnHistory] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [editTxnForm, setEditTxnForm] = useState({ quantity: '', price: '', notes: '', executed_at: '', brokerage: '' });
  const [editTxnSaving, setEditTxnSaving] = useState(false);
  const [deleteTxnId, setDeleteTxnId] = useState(null);
  const [deleteTxnSaving, setDeleteTxnSaving] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState(null);
  const [deleteBrokerageId, setDeleteBrokerageId] = useState(null);
  const [txnPatId, setTxnPatId] = useState(null);
  const [patModalTab, setPatModalTab] = useState('pat');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  const loadHolders = () => {
    if (!stock) return;
    setLoading(true);
    Promise.all([
      api.get(`/stocks/${stock.id}/holders`),
      api.get(`/stocks/${stock.id}/investments`),
    ])
      .then(([holdersRes, invRes]) => {
        setHolders(holdersRes.data);
        setInvestments(invRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const toggleSettled = async (field, value) => {
    try {
      if (activeGroupId) {
        const updated = await api.put(`/stocks/${stock.id}/groups/${activeGroupId}`, { [field]: value });
        setGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, ...updated.data } : g));
      } else {
        await api.put(`/stocks/${stock.id}`, { [field]: value });
        if (onReload) onReload();
        onClose();
      }
      if (field === 'investment_settled') setInvestmentSettled(value);
      else setPnlSettled(value);
      const label = field === 'investment_settled' ? 'Investment' : 'P/L';
      if (showToast) showToast(`${label} marked as ${value ? 'settled' : 'unsettled'}`);
    } catch (err) { alert(err.message); }
  };

  const loadGroups = () => {
    if (!stock) return;
    api.get(`/stocks/${stock.id}/groups`).then(r => setGroups(r.data)).catch(console.error);
  };

  const addGroup = async () => {
    const label = `Transaction ${groups.length + 1}`;
    try {
      const r = await api.post(`/stocks/${stock.id}/groups`, { label });
      setGroups(prev => [...prev, r.data]);
      setActiveGroupId(r.data.id);
    } catch (err) { alert(err.message); }
  };

  const deleteGroup = async (gid) => {
    try {
      await api.delete(`/stocks/${stock.id}/groups/${gid}`);
      setGroups(prev => prev.filter(g => g.id !== gid));
      if (activeGroupId === gid) setActiveGroupId(null);
      setDeleteGroupId(null);
      loadHolders();
    } catch (err) { alert(err.message); }
  };

  const assignHolderGroup = async (holderId, groupId) => {
    try {
      await api.put(`/stocks/${stock.id}/holders/${holderId}/group`, { group_id: groupId });
      loadHolders();
    } catch (err) { alert(err.message); }
  };

  const loadBrokerage = (gid) => {
    if (!stock) return;
    const param = gid !== undefined ? gid : activeGroupId;
    const url = param ? `/stocks/${stock.id}/brokerage?group_id=${param}` : `/stocks/${stock.id}/brokerage`;
    api.get(url).then(r => setBrokerageList(r.data)).catch(console.error);
  };

  const addBrokerage = async () => {
    const amt = parseFloat(newBrokerage);
    if (!amt || amt <= 0) return;
    try {
      await api.post(`/stocks/${stock.id}/brokerage`, { amount: amt, group_id: activeGroupId || null });
      setNewBrokerage('');
      loadBrokerage();
    } catch (err) { alert(err.message); }
  };

  const deleteBrokerage = async (tid) => {
    try {
      await api.delete(`/stocks/${stock.id}/brokerage/${tid}`);
      setDeleteBrokerageId(null);
      loadBrokerage();
    } catch (err) { alert(err.message); }
  };

  const openTxnHistory = (h) => {
    setTxnHolder(h);
    setTxnHistory([]);
    setTxnLoading(true);
    setEditTxn(null);
    setDeleteTxnId(null);
    setTxnPatId(null);
    const url = activeGroupId
      ? `/stocks/${stock.id}/holders/${h.id}/transactions?group_id=${activeGroupId}`
      : `/stocks/${stock.id}/holders/${h.id}/transactions`;
    api.get(url)
      .then(r => setTxnHistory(r.data))
      .catch(console.error)
      .finally(() => setTxnLoading(false));
  };

  const startEditTxn = (t) => {
    const d = new Date(t.executed_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setEditTxn(t);
    setEditTxnForm({ quantity: t.quantity, price: t.price, notes: t.notes || '', executed_at: dateStr, brokerage: parseFloat(t.brokerage || 0) || '' });
  };

  const saveEditTxn = async () => {
    setEditTxnSaving(true);
    try {
      const { data } = await api.put(`/stocks/${stock.id}/transactions/${editTxn.id}`, {
        quantity: parseFloat(editTxnForm.quantity),
        price: parseFloat(editTxnForm.price),
        notes: editTxnForm.notes || null,
        executed_at: editTxnForm.executed_at || null,
        brokerage: editTxnForm.brokerage ? parseFloat(editTxnForm.brokerage) : 0,
      });
      setTxnHistory(prev => prev.map(t => t.id === data.id ? data : t));
      setEditTxn(null);
      loadHolders();
    } catch (err) { alert(err.message); } finally { setEditTxnSaving(false); }
  };

  const confirmDeleteTxn = async () => {
    setDeleteTxnSaving(true);
    try {
      await api.delete(`/stocks/${stock.id}/transactions/${deleteTxnId}`);
      setTxnHistory(prev => prev.filter(t => t.id !== deleteTxnId));
      setDeleteTxnId(null);
      loadHolders();
    } catch (err) { alert(err.message); } finally { setDeleteTxnSaving(false); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      if (deleteHolder.txn_id) {
        await api.delete(`/stocks/${stock.id}/transactions/${deleteHolder.txn_id}`);
      } else {
        await api.delete(`/portfolio/${deleteHolder.id}/holding/${stock.id}`);
      }
      setDeleteHolder(null);
      loadHolders();
    } catch (err) { alert(err.message); } finally { setDeleting(false); }
  };

  useEffect(() => {
    if ((!open && !fullPage) || !stock) return;
    setInvestmentSettled(!!stock.investment_settled);
    setPnlSettled(!!stock.pnl_settled);
    setBrokerageList([]);
    setNewBrokerage('');
    setGroups([]);
    setActiveGroupId(null);
    loadHolders();
    loadBrokerage(null);
    loadGroups();
    api.get('/users').then(r => setAllUsers(r.data.filter(u => u.is_active))).catch(console.error);
  }, [open, stock]);

  useEffect(() => {
    if (!open || !stock) return;
    loadBrokerage(activeGroupId);
    if (activeGroupId) {
      const g = groups.find(g => g.id === activeGroupId);
      if (g) { setInvestmentSettled(!!g.investment_settled); setPnlSettled(!!g.pnl_settled); }
    } else {
      setInvestmentSettled(!!stock.investment_settled);
      setPnlSettled(!!stock.pnl_settled);
    }
  }, [activeGroupId]);

  const groupUserIds = activeGroupId
    ? [...new Set([
        ...investments.filter(inv => inv.group_id === activeGroupId).map(inv => inv.id),
        ...holders.filter(h => h.group_id === activeGroupId).map(h => h.id),
      ])]
    : null;
  const groupHolders = groupUserIds ? holders.filter(h => groupUserIds.includes(h.id)) : holders;
  // When a transaction tab is active, use per-transaction investment rows for status/P&L
  const activeInvRows = activeGroupId
    ? investments.filter(h => h.group_id === activeGroupId)
    : null;
  const allExited = activeGroupId
    ? activeInvRows.length > 0 && activeInvRows.every(h => h.status === 'exited')
    : groupHolders.length > 0 && groupHolders.every(h => h.status === 'exited');
  const totalInvested = activeGroupId
    ? activeInvRows.reduce((s, h) => s + parseFloat(h.invested_amount), 0)
    : groupHolders.reduce((s, h) => s + parseFloat(h.invested_amount), 0);
  const totalValue = activeGroupId
    ? activeInvRows.filter(h => h.status === 'active').reduce((s, h) => s + parseFloat(h.current_value), 0)
    : groupHolders.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const totalSoldPnl = activeGroupId
    ? activeInvRows.reduce((s, h) => s + parseFloat(h.realized_pnl || 0), 0)
    : groupHolders.reduce((s, h) => s + parseFloat(h.realized_pnl || 0), 0);
  const totalBuyAmount = activeGroupId
    ? activeInvRows.reduce((s, h) => s + parseFloat(h.total_buy_amount || 0), 0)
    : groupHolders.reduce((s, h) => s + parseFloat(h.total_buy_amount || 0), 0);
  const soldPnlPct = totalBuyAmount > 0 ? (totalSoldPnl / totalBuyAmount) * 100 : 0;
  const stockBrokerage = brokerageList.reduce((s, t) => s + parseFloat(t.amount), 0);
  const { totalPAT, totalTax } = (() => {
    const exitedRows = activeGroupId
      ? activeInvRows.filter(h => h.status === 'exited')
      : groupHolders.filter(h => h.status === 'exited');
    const totalPnl = exitedRows.reduce((s, h) => s + parseFloat(h.realized_pnl || 0), 0);
    const totalTxnBrokerage = exitedRows.reduce((s, h) => s + parseFloat(h.total_sell_brokerage || 0), 0);
    const netProfit = totalPnl - stockBrokerage - totalTxnBrokerage;
    if (netProfit <= 0) return { totalPAT: 0, totalTax: 0 };
    const avgDays = exitedRows.length > 0
      ? exitedRows.reduce((s, h) => {
          const days = h.first_buy_date && h.last_sell_date
            ? Math.floor((new Date(h.last_sell_date) - new Date(h.first_buy_date)) / 86400000)
            : 0;
          return s + days;
        }, 0) / exitedRows.length
      : 0;
    const tax = netProfit * (avgDays > 365 ? 0.125 : 0.20);
    return { totalPAT: netProfit - tax, totalTax: tax };
  })();

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const sortVal = (h, key) => {
    if (key === 'name') return h.name.toLowerCase();
    if (key === 'user_type') return h.user_type;
    if (key === 'status') return h.status;
    if (key === 'quantity') return parseFloat(h.status === 'exited' ? h.total_bought_quantity : h.quantity);
    if (key === 'avg_buy_price') return parseFloat(h.avg_buy_price);
    if (key === 'invested_amount') return parseFloat(h.invested_amount);
    if (key === 'current_value') return parseFloat(h.current_value);
    if (key === 'pnl') return h.status === 'active' ? parseFloat(h.unrealized_pnl) : parseFloat(h.realized_pnl);
    if (key === 'pnl_pct') {
      if (h.status === 'active') return parseFloat(h.pnl_percent);
      const b = parseFloat(h.total_buy_amount); return b > 0 ? parseFloat(h.realized_pnl) / b * 100 : 0;
    }
    return 0;
  };

  const displayed = investments
    .filter(h => filterStatus === 'all' || h.status === filterStatus)
    .filter(h => filterType === 'all' || h.user_type === filterType)
    .filter(h => !activeGroupId || h.group_id === activeGroupId)
    .sort((a, b) => {
      const av = sortVal(a, sort.key), bv = sortVal(b, sort.key);
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1);
    });

  const SortTh = ({ label, col }) => (
    <Th>
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-brand-600 transition-colors">
        {label}
        <span className="flex flex-col -space-y-1">
          <ChevronUp size={10} className={sort.key === col && sort.dir === 'asc' ? 'text-brand-600' : 'text-gray-300'} />
          <ChevronDown size={10} className={sort.key === col && sort.dir === 'desc' ? 'text-brand-600' : 'text-gray-300'} />
        </span>
      </button>
    </Th>
  );

  const innerContent = loading ? <SkeletonTable rows={4} cols={9} /> : (
    <div className="space-y-4">
            {/* Transaction group tabs */}
            <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 dark:border-gray-700 pb-2">
              <button
                onClick={() => setActiveGroupId(null)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  activeGroupId === null
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              {groups.map(g => (
                <div key={g.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => setActiveGroupId(g.id)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      activeGroupId === g.id
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {g.label}{g.holder_name ? ` · ${g.holder_name.split(' ')[0]}` : ''}
                  </button>
                  <button onClick={() => setDeleteGroupId(g.id)} className="text-gray-300 hover:text-red-500" title="Delete group">
                    <X size={11} />
                  </button>
                </div>
              ))}
              <button
                onClick={addGroup}
                className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 font-medium transition-colors"
              >
                + New Transaction
              </button>
            </div>
            {activeGroupId && <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={investmentSettled}
                  onChange={e => toggleSettled('investment_settled', e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Investment Settled</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={pnlSettled}
                  onChange={e => toggleSettled('pnl_settled', e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">P/L Settled</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Stockholder</span>
                <select
                  value={groups.find(g => g.id === activeGroupId)?.holder_id || ''}
                  onChange={async e => {
                    const val = e.target.value;
                    try {
                      const r = await api.put(`/stocks/${stock.id}/groups/${activeGroupId}`, { holder_id: val ? parseInt(val) : null });
                      setGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, holder_id: val ? parseInt(val) : null, holder_name: allUsers.find(u => u.id === parseInt(val))?.name || null } : g));
                    } catch(err) { alert(err.message); }
                  }}
                  className="text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1"
                >
                  <option value="">— None —</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.user_type})</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
                  Brokerage
                  {activeGroupId
                    ? <span className="ml-1 text-brand-600">({groups.find(g => g.id === activeGroupId)?.label})</span>
                    : <span className="ml-1 text-gray-400">(General)</span>
                  }
                  {stockBrokerage > 0 && <span className="ml-1 text-gray-700 dark:text-gray-200">= {fmt.currency(stockBrokerage)}</span>}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {brokerageList.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Txn {i + 1}:</span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{fmt.currency(parseFloat(t.amount))}</span>
                      <button onClick={() => setDeleteBrokerageId(t.id)} className="text-gray-300 hover:text-red-500 ml-0.5"><X size={11} /></button>
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="any" placeholder="Amount"
                      value={newBrokerage}
                      onChange={e => setNewBrokerage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addBrokerage()}
                      className="w-24 px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button onClick={addBrokerage} className="text-xs px-2 py-0.5 bg-brand-600 hover:bg-brand-700 text-white rounded">+ Add</button>
                  </div>
                </div>
              </div>
            </div>}
            <div className={`grid ${allExited ? 'grid-cols-5' : 'grid-cols-3'} gap-3`}>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Total Investors</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{activeGroupId ? activeInvRows.length : groupHolders.length}</p>
                </div>
                {allExited ? (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Sold P/L</p>
                      <p className={`text-xl font-bold mt-1 ${pnlColor(totalSoldPnl)}`}>{fmt.currency(totalSoldPnl)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Sold P/L %</p>
                      <p className={`text-xl font-bold mt-1 ${pnlColor(soldPnlPct)}`}>{fmt.percent(soldPnlPct)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Total PAT</p>
                      <p className={`text-xl font-bold mt-1 ${pnlColor(totalPAT)}`}>{fmt.currency(totalPAT)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Money Matrix Tax</p>
                      <p className="text-xl font-bold mt-1 text-red-500">{fmt.currency(totalTax)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Total Invested</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalInvested)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Current Value</p>
                      <p className={`text-xl font-bold mt-1 ${pnlColor(totalValue - totalInvested)}`}>{fmt.currency(totalValue)}</p>
                    </div>
                  </>
                )}
            </div>
            {activeGroupId && <div className="flex gap-2">
              <button onClick={() => setSellAllOpen(true)} className="text-xs px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center gap-1">
                <TrendingDown size={12} /> Sell All Shares
              </button>
              <button onClick={() => setAddOpen(true)} className="text-xs px-2 py-0.5 bg-brand-600 hover:bg-brand-700 text-white rounded flex items-center gap-1">
                <ShoppingCart size={12} /> Add Investment
              </button>
            </div>}
            {holders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {['all', 'active', 'exited'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                    {s}
                  </button>
                ))}
                <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                {['all', 'client', 'shareholder'].map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterType === t ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
            {investments.length === 0 ? (
              <p className="text-center py-8 text-gray-400 dark:text-gray-500">No investors in this stock yet</p>
            ) : displayed.length === 0 ? (
              <p className="text-center py-8 text-gray-400 dark:text-gray-500">No investors match the filter</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <SortTh label="Investor" col="name" />
                    <SortTh label="Type" col="user_type" />
                    <SortTh label="Status" col="status" />
                    <SortTh label="Shares" col="quantity" />
                    <Th>Buy Date</Th>
                    <SortTh label="Buy Price" col="avg_buy_price" />
                    <Th>Sell Price</Th>
                    <SortTh label="Amount Invested" col="invested_amount" />
                    <SortTh label="Current Value" col="current_value" />
                    <SortTh label="P&L" col="pnl" />
                    <SortTh label="P&L %" col="pnl_pct" />
                    <Th>PAT</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totQty = displayed.reduce((s, h) => s + parseFloat(h.status === 'exited' ? h.total_bought_quantity : h.quantity), 0);
                    const totInvested = displayed.reduce((s, h) => s + parseFloat(h.invested_amount), 0);
                    const totCurrent = displayed.filter(h => h.status === 'active').reduce((s, h) => s + parseFloat(h.current_value), 0);
                    const totPnl = displayed.reduce((s, h) => s + parseFloat(h.status === 'active' ? h.unrealized_pnl : h.realized_pnl), 0);
                    if (displayed.length < 2) return null;
                    return (
                      <tr className="bg-gray-50 dark:bg-gray-800/60 font-semibold text-xs border-t-2 border-gray-200 dark:border-gray-600">
                        <Td colSpan={3} className="text-gray-500 dark:text-gray-400">Total ({displayed.length})</Td>
                        <Td className="font-bold text-gray-900 dark:text-white">{fmt.number(totQty, 2)}</Td>
                        <Td>—</Td>
                        <Td>—</Td>
                        <Td>—</Td>
                        <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(totInvested)}</Td>
                        <Td className="font-bold text-gray-900 dark:text-white">{totCurrent > 0 ? fmt.currency(totCurrent) : '—'}</Td>
                        <Td><span className={pnlColor(totPnl)}>{pnlSign(totPnl)}{fmt.currency(totPnl)}</span></Td>
                        <Td colSpan={3}><span className={pnlColor(totPnl / totInvested * 100)}>{pnlSign(totPnl / totInvested * 100)}{fmt.percent(Math.abs(totPnl / totInvested * 100))}</span></Td>
                      </tr>
                    );
                  })()}
                  {displayed.map(h => {
                    const dim = h.status === 'exited' ? 'opacity-60' : '';
                    const holder = holders.find(hh => hh.id === h.id) || h;
                    const rowKey = h.txn_id != null ? h.txn_id : h.id;
                    return (
                    <tr key={rowKey} onClick={h.status === 'exited' ? () => setPatHolder(holder) : undefined} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${h.status === 'exited' ? 'cursor-pointer' : ''}`}>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-shrink-0">
                            <button
                              onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const flip = window.innerHeight - r.bottom < 160; setMenuPos({ top: flip ? r.top - 160 : r.bottom, left: r.left }); setOpenMenuId(openMenuId === rowKey ? null : rowKey); }}
                              className="p-1 text-gray-400 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            >
                              <MoreVertical size={14} />
                            </button>
                            {openMenuId === rowKey && (
                              <div
                                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                                className="w-40 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg shadow-xl dark:shadow-black/60 py-1"
                                onMouseLeave={() => setOpenMenuId(null)}
                                onClick={e => e.stopPropagation()}
                              >
                                {h.status === 'active' && (
                                  <button onClick={() => { setSellHolder(activeGroupId ? { ...holder, quantity: Math.min(parseFloat(h.remaining_quantity ?? h.quantity), parseFloat(holder.quantity)) } : holder); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-orange-600 hover:bg-gray-100 dark:hover:bg-gray-500 flex items-center gap-2">
                                    <TrendingDown size={13} /> Sell Shares
                                  </button>
                                )}
                                <button onClick={() => { openTxnHistory(holder); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-500 flex items-center gap-2">
                                  <History size={13} /> History
                                </button>
                                <button onClick={() => { setEditHolder(holder); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-500 flex items-center gap-2">
                                  <Pencil size={13} /> Edit
                                </button>
                                <button onClick={() => { setDeleteHolder(h.txn_id ? { ...holder, txn_id: h.txn_id } : holder); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-gray-100 dark:hover:bg-gray-500 flex items-center gap-2">
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                          <div className={dim}>
                            <p className="font-medium text-gray-900 dark:text-white">{h.name}</p>
                            <p className="text-xs text-gray-500">{h.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className={dim}><span className={h.user_type === 'shareholder' ? 'badge-blue' : 'badge-gray'}>{h.user_type}</span></Td>
                      <Td className={dim}><span className={h.status === 'active' ? 'badge-green' : 'badge-red'}>{h.status}</span></Td>
                      <Td className={`font-medium ${dim}`}>{fmt.number(h.status === 'exited' ? h.total_bought_quantity : h.quantity, 2)}</Td>
                      <Td className={`text-xs text-gray-500 whitespace-nowrap ${dim}`}>{h.first_buy_date ? fmt.date(h.first_buy_date) : '—'}</Td>
                      <Td className={dim}>{fmt.currency(h.avg_buy_price)}</Td>
                      <Td className={dim}>{h.avg_sell_price ? fmt.currency(h.avg_sell_price) : '—'}</Td>
                      <Td className={dim}>{fmt.currency(h.invested_amount)}</Td>
                      <Td className={`font-medium ${dim}`}>{h.status === 'active' ? fmt.currency(h.current_value) : '—'}</Td>
                      <Td className={dim}>
                        {h.status === 'active' ? (() => {
                          const partialSellAmt = parseFloat(h.total_sell_amount || 0);
                          const partialPnl = partialSellAmt > 0
                            ? partialSellAmt - (parseFloat(h.avg_buy_price) * (parseFloat(h.total_bought_quantity) - parseFloat(h.quantity)))
                            : null;
                          return (
                            <div>
                              <span className={pnlColor(h.unrealized_pnl)}>{pnlSign(h.unrealized_pnl)}{fmt.currency(h.unrealized_pnl)}</span>
                              {partialPnl !== null && (
                                <button
                                  onClick={e => { e.stopPropagation(); setPatHolder(h); }}
                                  className={`text-[10px] mt-0.5 block underline decoration-dotted ${pnlColor(partialPnl)}`}
                                  title="View PAT breakdown for partial sell"
                                >
                                  Sold: {pnlSign(partialPnl)}{fmt.currency(partialPnl)}
                                </button>
                              )}
                            </div>
                          );
                        })()
                          : <span className={pnlColor(h.realized_pnl)}>{pnlSign(h.realized_pnl)}{fmt.currency(h.realized_pnl)}</span>
                        }
                      </Td>
                      <Td className={dim}>
                        {h.status === 'active'
                          ? <span className={pnlColor(h.pnl_percent)}>{pnlSign(h.pnl_percent)}{fmt.percent(h.pnl_percent)}</span>
                          : (() => {
                              const buyAmt = parseFloat(h.total_buy_amount);
                              const pct = buyAmt > 0 ? ((parseFloat(h.realized_pnl) / buyAmt) * 100) : 0;
                              return <span className={pnlColor(pct)}>{pnlSign(pct)}{fmt.percent(pct)}</span>;
                            })()
                        }
                      </Td>
                      <Td className={dim}>
                        {h.status === 'exited' ? (() => {
                          const pnl = parseFloat(h.realized_pnl || 0);
                          const totalExitedPnl = groupHolders.filter(x => x.status === 'exited').reduce((s, x) => s + parseFloat(x.realized_pnl || 0), 0);
                          const groupBrokerageShare = totalExitedPnl > 0 ? stockBrokerage * (pnl / totalExitedPnl) : 0;
                          const holderBrokerage = groupBrokerageShare + parseFloat(h.total_sell_brokerage || 0);
                          const netProfit = pnl - holderBrokerage;
                          if (netProfit <= 0) return <span className="text-gray-400">—</span>;
                          const days = h.first_buy_date
                            ? Math.floor(((h.last_sell_date ? new Date(h.last_sell_date) : new Date()) - new Date(h.first_buy_date)) / 86400000)
                            : 0;
                          const taxRate = days > 365 ? 0.125 : 0.20;
                          const tax = netProfit * taxRate;
                          const pat = netProfit - tax;
                          return (
                            <div>
                              <p className="text-green-600 font-medium">{fmt.currency(pat)}</p>
                              <p className="text-[10px] text-gray-400">{days > 365 ? 'LTCG 12.5%' : 'STCG 20%'}</p>
                            </div>
                          );
                        })() : <span className="text-gray-400">—</span> }
                      </Td>
                      <Td className={dim}>
                        <select
                          value={h.group_id || ''}
                          onChange={e => assignHolderGroup(h.id, e.target.value || null)}
                          className="text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1 py-0.5"
                          title="Assign to transaction"
                        >
                          <option value="">—</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                        </select>
                      </Td>
                    </tr>
                  ); })}

                </tbody>
              </Table>
            )}
          </div>
    );

  const subModals = (
    <>
      <AddInvestmentModal stock={stock} open={addOpen} onClose={() => setAddOpen(false)} onDone={loadHolders} groupId={activeGroupId} />
      <SellAllModal stock={stock} holders={activeGroupId
        ? groupHolders.map(h => {
            const currentQty = parseFloat(h.quantity);
            // Use remaining_quantity from investments (buy qty minus already sold for this group)
            const inv = investments.find(inv => inv.group_id === activeGroupId && inv.id === h.id);
            if (inv) return { ...h, quantity: Math.min(parseFloat(inv.remaining_quantity), currentQty) };
            // Old data: t.group_id not set — use unassigned buy transaction remaining
            const oldInv = investments.find(inv => inv.group_id == null && inv.id === h.id);
            return { ...h, quantity: oldInv ? Math.min(parseFloat(oldInv.remaining_quantity), currentQty) : currentQty };
          })
        : groupHolders} open={sellAllOpen} onClose={() => setSellAllOpen(false)} onDone={loadHolders} groupId={activeGroupId} />
      <SellModal stock={stock} holder={sellHolder} open={!!sellHolder} onClose={() => setSellHolder(null)} onDone={loadHolders} groupId={activeGroupId} />
      <EditHoldingModal stock={stock} holder={editHolder} open={!!editHolder} onClose={() => setEditHolder(null)} onDone={loadHolders} />
      <Modal open={!!patHolder} onClose={() => { setPatHolder(null); setPatModalTab('pat'); }} title="PAT Breakdown">
        {patHolder && (() => {
          const isPartial = patHolder.status === 'active';
          const soldQty = isPartial
            ? parseFloat(patHolder.total_bought_quantity) - parseFloat(patHolder.quantity)
            : 0;
          const pnl = isPartial
            ? parseFloat(patHolder.total_sell_amount || 0) - (parseFloat(patHolder.avg_buy_price) * soldQty)
            : parseFloat(patHolder.realized_pnl || 0);

          const totalRealizedPnl = groupHolders.reduce((s, x) => {
            if (x.status === 'exited') return s + parseFloat(x.realized_pnl || 0);
            const partSell = parseFloat(x.total_sell_amount || 0);
            if (partSell > 0) {
              const partPnl = partSell - parseFloat(x.avg_buy_price) * (parseFloat(x.total_bought_quantity) - parseFloat(x.quantity));
              return s + Math.max(0, partPnl);
            }
            return s;
          }, 0);

          const groupBrokerageShare = totalRealizedPnl > 0 ? stockBrokerage * (Math.max(0, pnl) / totalRealizedPnl) : 0;
          const holderBrokerage = groupBrokerageShare + parseFloat(patHolder.total_sell_brokerage || 0);
          const netProfit = pnl - holderBrokerage;
          const days = patHolder.first_buy_date
            ? Math.floor(((patHolder.last_sell_date ? new Date(patHolder.last_sell_date) : new Date()) - new Date(patHolder.first_buy_date)) / 86400000)
            : 0;
          const taxRate = days > 365 ? 0.125 : 0.20;
          const tax = netProfit > 0 ? netProfit * taxRate : 0;
          const pat = netProfit > 0 ? netProfit - tax : 0;
          const shareholderTaking = pat * 0.30;
          const companyTaking = pat * 0.70;
          const investedAmount = parseFloat(patHolder.total_buy_amount || 0);
          const settlement = pnl >= 0
            ? investedAmount + shareholderTaking
            : investedAmount + pnl - holderBrokerage;

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{patHolder.name}</p>
                {isPartial && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Partial Sell</span>}
              </div>
              {isPartial && (
                <p className="text-xs text-gray-500">Based on {fmt.number(soldQty, 2)} sold shares. Remaining {fmt.number(parseFloat(patHolder.quantity), 2)} shares still active.</p>
              )}

              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {['pat', 'settlement'].map(tab => (
                  <button key={tab} onClick={() => setPatModalTab(tab)}
                    className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${patModalTab === tab ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {tab === 'pat' ? 'PAT' : 'Settlement'}
                  </button>
                ))}
              </div>

              {patModalTab === 'pat' ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Sold P/L</span>
                    <span className={`font-medium ${pnlColor(pnl)}`}>{fmt.currency(pnl)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Brokerage</span>
                    <span className="font-medium text-red-500">−{fmt.currency(holderBrokerage)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Tax ({days > 365 ? 'LTCG 12.5%' : 'STCG 20%'})</span>
                    <span className="font-medium text-red-500">−{fmt.currency(tax)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">PAT</span>
                    <span className={`font-bold ${pnlColor(pat)}`}>{fmt.currency(pat)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Shareholder Takings <span className="text-xs text-gray-400">(30%)</span></span>
                    <span className="font-semibold text-blue-600">{fmt.currency(shareholderTaking)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Company Takings <span className="text-xs text-gray-400">(70%)</span></span>
                    <span className="font-semibold text-purple-600">{fmt.currency(companyTaking)}</span>
                  </div>
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
                        <span className="text-sm text-gray-700 dark:text-gray-300">Shareholder Takings <span className="text-xs text-gray-400">(30% of PAT)</span></span>
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
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500">Brokerage</span>
                        <span className="font-medium text-red-500">−{fmt.currency(holderBrokerage)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t-2 border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Total Settlement</span>
                        <span className={`text-xl font-bold ${pnlColor(settlement)}`}>{fmt.currency(settlement)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button onClick={() => { setPatHolder(null); setPatModalTab('pat'); }} className="btn-secondary w-full">Close</button>
            </div>
          );
        })()}
      </Modal>
      <Modal open={!!deleteHolder} onClose={() => setDeleteHolder(null)} title="Remove Holding">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Remove <strong>{deleteHolder?.name}</strong>'s holding in <strong>{stock?.symbol}</strong>? This only removes the holding record — past transactions are kept.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteHolder(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} disabled={deleting} className="btn-danger flex-1">{deleting ? 'Removing...' : 'Remove'}</button>
          </div>
        </div>
      </Modal>
      <Modal open={!!txnHolder} onClose={() => setTxnHolder(null)} title={txnHolder ? `Transactions — ${txnHolder.name}` : ''}>
        {txnLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : txnHistory.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No transactions found.</div>
        ) : (
          <div className="space-y-2">
            {(() => {
              // Brokerage allocation: holder's share of stockBrokerage, then per-transaction share
              const avgBuy = txnHolder ? parseFloat(txnHolder.avg_buy_price) : 0;

              // Total realized P&L across all group holders (for holder's brokerage share)
              const totalGroupRealizedPnl = groupHolders.reduce((s, x) => {
                if (x.status === 'exited') return s + Math.max(0, parseFloat(x.realized_pnl || 0));
                const partSell = parseFloat(x.total_sell_amount || 0);
                if (partSell > 0) {
                  const pp = partSell - parseFloat(x.avg_buy_price) * (parseFloat(x.total_bought_quantity) - parseFloat(x.quantity));
                  return s + Math.max(0, pp);
                }
                return s;
              }, 0);

              // This holder's realized P&L (from sell transactions in history)
              const holderSellPnl = txnHistory
                .filter(t => t.type === 'sell')
                .reduce((s, t) => s + Math.max(0, parseFloat(t.total) - avgBuy * parseFloat(t.quantity)), 0);

              // Holder's proportional brokerage
              const holderBrokerageShare = totalGroupRealizedPnl > 0
                ? stockBrokerage * (holderSellPnl / totalGroupRealizedPnl)
                : 0;

              return txnHistory.map((t) => {
              const isBuy = t.type === 'buy';
              const isEditing = editTxn?.id === t.id;
              const isConfirmDelete = deleteTxnId === t.id;
              const isPatOpen = txnPatId === t.id;

              // PAT calculation for this sell (with brokerage stored on the transaction)
              const txnPat = !isBuy && txnHolder ? (() => {
                const cost = avgBuy * parseFloat(t.quantity);
                const pnl = parseFloat(t.total) - cost;
                const txnBrokerage = parseFloat(t.brokerage || 0);
                const netPnl = pnl - txnBrokerage;
                const days = txnHolder.first_buy_date
                  ? Math.floor((new Date(t.executed_at) - new Date(txnHolder.first_buy_date)) / 86400000)
                  : 0;
                const taxRate = days > 365 ? 0.125 : 0.20;
                const tax = netPnl > 0 ? netPnl * taxRate : 0;
                const pat = netPnl > 0 ? netPnl - tax : 0;
                return { pnl, cost, txnBrokerage, netPnl, days, taxRate, tax, pat, shareholderTaking: pat * 0.30, companyTaking: pat * 0.70 };
              })() : null;

              return (
                <div key={t.id} className={`rounded-lg border ${isBuy ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800'}`}>
                  <div
                    className={`flex items-center justify-between p-3 ${!isBuy ? 'cursor-pointer' : ''}`}
                    onClick={!isBuy ? () => setTxnPatId(isPatOpen ? null : t.id) : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300'}`}>
                        {t.type.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {fmt.number(t.quantity, 2)} shares @ {fmt.currency(t.price)}
                        </p>
                        <p className="text-xs text-gray-500">{fmt.date(t.executed_at)}{t.notes ? ` · ${t.notes}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm ${isBuy ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {isBuy ? '−' : '+'}{fmt.currency(t.total)}
                      </p>
                      <button onClick={e => { e.stopPropagation(); isEditing ? setEditTxn(null) : startEditTxn(t); }}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteTxnId(t.id); }}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {isPatOpen && txnPat && (
                    <div className="px-3 pb-3 border-t border-orange-100 dark:border-orange-800 pt-3 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">PAT Breakdown</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Sell Proceeds</span>
                        <span className="font-medium text-gray-900 dark:text-white">{fmt.currency(t.total)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Cost ({fmt.number(t.quantity, 2)} × {fmt.currency(txnHolder.avg_buy_price)})</span>
                        <span className="font-medium text-red-500">−{fmt.currency(txnPat.cost)}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-orange-100 dark:border-orange-800 pt-1.5">
                        <span className="text-gray-500">P/L</span>
                        <span className={`font-medium ${pnlColor(txnPat.pnl)}`}>{pnlSign(txnPat.pnl)}{fmt.currency(txnPat.pnl)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Brokerage</span>
                        <span className="font-medium text-red-500">−{fmt.currency(txnPat.txnBrokerage)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Tax ({txnPat.days > 365 ? 'LTCG 12.5%' : 'STCG 20%'}, {txnPat.days}d)</span>
                        <span className="font-medium text-red-500">−{fmt.currency(txnPat.tax)}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-orange-100 dark:border-orange-800 pt-1.5 font-semibold">
                        <span className="text-gray-700 dark:text-gray-300">PAT</span>
                        <span className={pnlColor(txnPat.pat)}>{fmt.currency(txnPat.pat)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Shareholder (30%)</span>
                        <span className="font-medium text-blue-600">{fmt.currency(txnPat.shareholderTaking)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Company (70%)</span>
                        <span className="font-medium text-purple-600">{fmt.currency(txnPat.companyTaking)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">* Cost basis uses current avg buy price.</p>
                    </div>
                  )}
                  {isEditing && (
                    <div className="px-3 pb-3 border-t border-blue-100 dark:border-blue-800 pt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                          <input type="number" step="0.01" className="input text-sm py-1" value={editTxnForm.quantity}
                            onChange={e => setEditTxnForm(f => ({ ...f, quantity: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Price</label>
                          <input type="number" step="0.01" className="input text-sm py-1" value={editTxnForm.price}
                            onChange={e => setEditTxnForm(f => ({ ...f, price: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Date</label>
                          <input type="date" className="input text-sm py-1" value={editTxnForm.executed_at}
                            onChange={e => setEditTxnForm(f => ({ ...f, executed_at: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                          <input type="text" className="input text-sm py-1" value={editTxnForm.notes}
                            onChange={e => setEditTxnForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        {editTxn?.type === 'sell' && (
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Brokerage (₹)</label>
                            <input type="number" step="any" min="0" className="input text-sm py-1" placeholder="0" value={editTxnForm.brokerage}
                              onChange={e => setEditTxnForm(f => ({ ...f, brokerage: e.target.value }))} />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEditTxn} disabled={editTxnSaving}
                          className="btn-primary text-xs px-3 py-1">{editTxnSaving ? 'Saving...' : 'Save'}</button>
                        <button onClick={() => setEditTxn(null)} className="btn-secondary text-xs px-3 py-1">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
            })()}
          </div>
        )}
      </Modal>
      <Modal open={!!deleteTxnId} onClose={() => setDeleteTxnId(null)} title="Delete Transaction">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Delete this transaction? The holding quantity and average price will be adjusted accordingly. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTxnId(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDeleteTxn} disabled={deleteTxnSaving} className="btn-danger flex-1">
              {deleteTxnSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={!!deleteGroupId} onClose={() => setDeleteGroupId(null)} title="Delete Transaction Group">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Delete this transaction group? The group label and any associated brokerage entries will be removed. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteGroupId(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => deleteGroup(deleteGroupId)} className="btn-danger flex-1">Delete</button>
          </div>
        </div>
      </Modal>
      <Modal open={!!deleteBrokerageId} onClose={() => setDeleteBrokerageId(null)} title="Delete Brokerage Entry">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Remove this brokerage entry? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteBrokerageId(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => deleteBrokerage(deleteBrokerageId)} className="btn-danger flex-1">Delete</button>
          </div>
        </div>
      </Modal>
    </>
  );

  if (fullPage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{stock?.symbol} · {stock?.name}</h1>
            <p className="text-sm text-gray-500">{stock?.sector || 'Investors'}</p>
          </div>
          {stock && (
            <button onClick={() => onEdit(stock)} className="ml-auto p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors" title="Edit stock">
              <Edit2 size={16} />
            </button>
          )}
        </div>
        {innerContent}
        {subModals}
      </div>
    );
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={stock ? `Investors — ${stock.symbol} · ${stock.name}` : ''} size="xl"
        headerAction={stock && (
          <button onClick={() => { onClose(); onEdit(stock); }} className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors" title="Edit stock">
            <Edit2 size={16} />
          </button>
        )}>
        {innerContent}
      </Modal>
      {subModals}
    </>
  );
}

export default function StocksPage() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [holderPickStock, setHolderPickStock] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [error, setError] = useState('');
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshMsg, setRefreshMsg] = useState({});
  const [deleteStock, setDeleteStock] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [stockMenuId, setStockMenuId] = useState(null);
  const [stockMenuPos, setStockMenuPos] = useState({ top: 0, left: 0 });
  const [tableSort, setTableSort] = useState({ key: 'symbol', dir: 'asc' });
  const [stockFilter, setStockFilter] = useState('active');
  const [stockPage, setStockPage] = useState(1);
  const [stockSearch, setStockSearch] = useState('');
  const [stockLimit, setStockLimit] = useState(10);
  const navigate = useNavigate();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    setLoading(true);
    api.get('/stocks/all')
      .then(r => {
        setStocks(r.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => { setForm(EMPTY); setError(''); setModal('create'); };
  const openEdit = (s) => {
    setSelected(s);
    setForm({ symbol: s.symbol, name: s.name, sector: s.sector || '', current_price: s.current_price, is_active: s.is_active });
    setError('');
    setModal('edit');
  };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (modal === 'create') await api.post('/stocks', form);
      else await api.put(`/stocks/${selected.id}`, { ...form, current_price: parseFloat(form.current_price) });
      setModal(null); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const toggleActive = async (s) => {
    try { await api.put(`/stocks/${s.id}`, { is_active: !s.is_active }); load(); } catch (err) { alert(err.message); }
  };

  const confirmDeleteStock = async () => {
    setDeleting(true);
    try { await api.delete(`/stocks/${deleteStock.id}`); setDeleteStock(null); load(); }
    catch (err) { alert(err.message); } finally { setDeleting(false); }
  };

  const fetchPriceIntoForm = async () => {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) { setError('Enter a symbol first'); return; }
    setError(''); setFetchingPrice(true);
    try {
      const stockId = selected?.id;
      let price, name, sector;
      if (stockId) {
        const res = await api.post(`/stocks/${stockId}/fetch-price`, {});
        price = res.data.price;
        name = form.name;
        sector = res.data.sector;
        load();
      } else {
        const res = await api.post('/stocks/preview-price', { symbol: sym });
        price = res.data.price;
        name = res.data.name;
        sector = res.data.sector;
      }
      setForm(f => ({ ...f, current_price: price, name: f.name || name || f.name, sector: f.sector || sector || f.sector }));
    } catch (err) { setError(err.message); } finally { setFetchingPrice(false); }
  };

  const refreshPrice = async (s) => {
    setRefreshingId(s.id);
    setRefreshMsg(m => ({ ...m, [s.id]: null }));
    try {
      const res = await api.post(`/stocks/${s.id}/fetch-price`, {});
      setRefreshMsg(m => ({ ...m, [s.id]: { ok: true, text: `Updated to ${fmt.currency(res.data.price)} (via ${res.data.fetched_symbol})` } }));
      load();
    } catch (err) {
      setRefreshMsg(m => ({ ...m, [s.id]: { ok: false, text: err.message } }));
    } finally { setRefreshingId(null); }
  };

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={8} cols={9} />
    </div>
  );

  const toggleTableSort = (key) => setTableSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const filteredStocks = stocks
    .filter(s => stockFilter === 'all' || (stockFilter === 'active' ? s.is_active : !s.is_active))
    .filter(s => !stockSearch.trim() || s.symbol.toLowerCase().includes(stockSearch.toLowerCase()) || s.name.toLowerCase().includes(stockSearch.toLowerCase()));


  const sortedStocks = [...filteredStocks].sort((a, b) => {
    const { key, dir } = tableSort;
    let av = a[key], bv = b[key];
    if (key === 'change') { av = parseFloat(a.current_price) - parseFloat(a.previous_close); bv = parseFloat(b.current_price) - parseFloat(b.previous_close); }
    if (key === 'period') { av = a.first_investment_date ? new Date(a.first_investment_date).getTime() : 0; bv = b.first_investment_date ? new Date(b.first_investment_date).getTime() : 0; }
    if (av == null || av === '') av = dir === 'asc' ? Infinity : -Infinity;
    if (bv == null || bv === '') bv = dir === 'asc' ? Infinity : -Infinity;
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return dir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sortedStocks.length / stockLimit);
  const pagedStocks = sortedStocks.slice((stockPage - 1) * stockLimit, stockPage * stockLimit);

  const SortThMain = ({ label, col }) => (
    <Th>
      <button onClick={() => toggleTableSort(col)} className="flex items-center gap-1 hover:text-brand-600 transition-colors whitespace-nowrap">
        {label}
        <span className="flex flex-col -space-y-1">
          <ChevronUp size={10} className={tableSort.key === col && tableSort.dir === 'asc' ? 'text-brand-600' : 'text-gray-300'} />
          <ChevronDown size={10} className={tableSort.key === col && tableSort.dir === 'desc' ? 'text-brand-600' : 'text-gray-300'} />
        </span>
      </button>
    </Th>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stocks</h1>
          <p className="text-gray-500 text-sm mt-1">Manage company-traded securities and view investors</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Stock
        </button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex">
            {[{ key: 'all', label: 'All', count: stocks.length }, { key: 'active', label: 'Active', count: stocks.filter(s => s.is_active).length }, { key: 'inactive', label: 'Inactive', count: stocks.filter(s => !s.is_active).length }].map(tab => (
              <button key={tab.key} onClick={() => { setStockFilter(tab.key); setStockPage(1); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${stockFilter === tab.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${stockFilter === tab.key ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
              {[5, 10, 15, 20, 25].map(n => (
                <button key={n} onClick={() => { setStockLimit(n); setStockPage(1); }}
                  className={`px-2.5 py-1 transition-colors ${stockLimit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {n}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search symbol or name…"
              value={stockSearch}
              onChange={e => { setStockSearch(e.target.value); setStockPage(1); }}
              className="w-48 px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <SortThMain label="Symbol" col="symbol" />
              <SortThMain label="Name" col="name" />
              <SortThMain label="Sector" col="sector" />
              <SortThMain label="Current Price" col="current_price" />
              <SortThMain label="Buy Price" col="common_buy_price" />
              <SortThMain label="Period" col="period" />
              <SortThMain label="Status" col="is_active" />
              <SortThMain label="Updated" col="last_updated" />
            </tr>
          </thead>
          <tbody>
            {!sortedStocks.length && <EmptyRow cols={12} message="No stocks added yet" />}
            {pagedStocks.map(s => {
              const msg = refreshMsg[s.id];
              return (
                <>
                  <tr key={s.id} onClick={() => navigate('/admin/stocks/' + s.id)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const flip = window.innerHeight - r.bottom < 160; setStockMenuPos({ top: flip ? r.top - 160 : r.bottom, left: r.left }); setStockMenuId(stockMenuId === s.id ? null : s.id); }}
                            className="p-1 text-gray-400 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {stockMenuId === s.id && (
                            <div
                              style={{ position: 'fixed', top: stockMenuPos.top, left: stockMenuPos.left, zIndex: 9999 }}
                              className="w-44 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg shadow-xl dark:shadow-black/60 py-1"
                              onMouseLeave={() => setStockMenuId(null)}
                              onClick={e => e.stopPropagation()}
                            >
                              <button onClick={() => { openEdit(s); setStockMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-500 flex items-center gap-2">
                                <Edit2 size={13} /> Edit
                              </button>
                              <button onClick={() => { refreshPrice(s); setStockMenuId(null); }} disabled={refreshingId === s.id} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-500 flex items-center gap-2">
                                {refreshingId === s.id ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh Price
                              </button>
                              <button onClick={() => { toggleActive(s); setStockMenuId(null); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${s.is_active ? 'text-orange-600' : 'text-green-600'}`}>
                                {s.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button onClick={() => { setDeleteStock(s); setStockMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-gray-100 dark:hover:bg-gray-500 flex items-center gap-2">
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-brand-600 dark:text-brand-400 cursor-pointer" onClick={() => navigate('/admin/stocks/' + s.id)}>{s.symbol}</span>
                      </div>
                    </Td>
                    <Td className="font-medium text-gray-900 dark:text-white">{s.name}</Td>
                    <Td><span className="badge-blue">{s.sector || '—'}</span></Td>
                    <Td className="font-medium">{fmt.currency(s.current_price)}</Td>
                    <Td className="text-xs text-gray-500 whitespace-nowrap">{s.common_buy_price ? fmt.currency(s.common_buy_price) : '—'}</Td>
                    <Td className="text-xs text-gray-500 whitespace-nowrap">{holdingPeriod(s.first_investment_date, s.last_sell_date)}</Td>
                    <Td><span className={s.is_active ? 'badge-green' : 'badge-red'}>{s.is_active ? 'Active' : 'Inactive'}</span></Td>
                    <Td className="text-gray-500 text-xs">{s.last_updated ? fmt.datetime(s.last_updated) : '—'}</Td>
                  </tr>
                  {msg && (
                    <tr key={`msg-${s.id}`}>
                      <td colSpan={12} className={`px-4 py-1.5 text-xs border-b border-gray-100 dark:border-gray-800 ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {msg.text}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {(stockPage - 1) * stockLimit + 1}–{Math.min(stockPage * stockLimit, sortedStocks.length)} of {sortedStocks.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setStockPage(p => Math.max(1, p - 1))} disabled={stockPage === 1}
                className="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - stockPage) <= 1).reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, []).map((p, i) => p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-xs">…</span>
              ) : (
                <button key={p} onClick={() => setStockPage(p)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${stockPage === p ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setStockPage(p => Math.min(totalPages, p + 1))} disabled={stockPage === totalPages}
                className="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Add Stock' : 'Edit Stock'}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Symbol</label>
              <input className="input uppercase" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} required disabled={modal === 'edit'} placeholder="e.g. RELIANCE" />
            </div>
            <div>
              <label className="label">Current Price (₹)</label>
              <div className="flex gap-2">
                <input type="number" className="input" min="0" step="0.01" value={form.current_price} onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} required />
                <button type="button" onClick={fetchPriceIntoForm} disabled={fetchingPrice} title="Auto-fetch live price" className="btn-secondary px-3 flex-shrink-0">
                  {fetchingPrice ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Click refresh to fetch live price (NSE/BSE)</p>
            </div>
            <div className="col-span-2">
              <label className="label">Company Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="col-span-2">
              <label className="label">Sector (optional)</label>
              <input className="input" placeholder="e.g. Technology, Finance..." value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <StockHolderModal stock={holderPickStock} open={!!holderPickStock} onClose={() => setHolderPickStock(null)} onDone={load} />

      <Modal open={!!deleteStock} onClose={() => setDeleteStock(null)} title="Delete Stock">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Permanently delete <strong>{deleteStock?.symbol} — {deleteStock?.name}</strong>? This will remove all holdings and transaction history for this stock. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteStock(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDeleteStock} disabled={deleting} className="btn-danger flex-1">{deleting ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl shadow-lg text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
