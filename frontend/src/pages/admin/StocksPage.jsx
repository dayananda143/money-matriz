import { useEffect, useState } from 'react';
import { Plus, Edit2, TrendingUp, TrendingDown, RefreshCw, Loader, ShoppingCart, Pencil, Trash2, ChevronUp, ChevronDown, UserCheck, X } from 'lucide-react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const EMPTY = { symbol: '', name: '', sector: '', current_price: '', is_active: true };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const TRADE_EMPTY = { user_id: '', quantity: '', price: '', notes: '', executed_at: today() };

function AddInvestmentModal({ stock, open, onClose, onDone }) {
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
    setPrice(stock?.current_price || '');
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

  const setQty = (id, val) => setSelections(s => ({ ...s, [id]: val }));

  const tabs = ['all', ...([...new Set(users.map(u => u.user_type))].sort())];
  const visibleUsers = tab === 'all' ? users : users.filter(u => u.user_type === tab);
  const selected = Object.entries(selections);
  const totalShares = selected.reduce((s, [, q]) => s + (parseFloat(q) || 0), 0);
  const totalValue = totalShares * (parseFloat(price) || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected.length) { setError('Select at least one investor'); return; }
    const invalid = selected.find(([, q]) => !q || parseFloat(q) <= 0);
    if (invalid) { setError('Enter quantity for all selected investors'); return; }
    setError(''); setSaving(true);
    try {
      await Promise.all(selected.map(([userId, qty]) =>
        api.post(`/portfolio/${userId}/trade`, {
          stock_id: stock.id,
          type: 'buy',
          quantity: parseFloat(qty),
          price: parseFloat(price),
          notes: notes || undefined,
          executed_at: executedAt || undefined,
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
          <label className="label">Investors & Quantities</label>
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
              const qty = selections[u.id] ?? '';
              return (
                <div key={u.id} className={`flex items-center gap-3 px-3 py-2 ${checked ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(u.id)}
                    className="w-4 h-4 rounded accent-brand-600 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
                    {u.name} <span className="text-xs text-gray-400">({u.user_type})</span>
                  </span>
                  {checked && (
                    <input type="number" min="0.0001" step="0.0001" placeholder="Qty"
                      value={qty} onChange={e => setQty(u.id, e.target.value)}
                      className="input w-24 py-1 text-sm" autoFocus />
                  )}
                  {checked && qty && price && (
                    <span className="text-xs text-brand-600 dark:text-brand-400 flex-shrink-0 w-24 text-right">
                      {fmt.currency(parseFloat(qty) * parseFloat(price))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selected.length > 0 && price && totalShares > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400 flex justify-between">
            <span>{selected.length} investor{selected.length > 1 ? 's' : ''} · {fmt.number(totalShares, 4)} shares</span>
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
            <input type="number" className="input" min="0" step="0.0001" value={form.quantity}
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

function SellModal({ stock, holder, open, onClose, onDone }) {
  const [form, setForm] = useState({ quantity: '', price: '', notes: '', executed_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !holder || !stock) return;
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    setForm({ quantity: '', price: stock.current_price, notes: '', executed_at: today });
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
        notes: form.notes || undefined,
        executed_at: form.executed_at || undefined,
      });
      onDone();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const maxQty = parseFloat(holder?.quantity || 0);

  return (
    <Modal open={open} onClose={onClose} title={holder ? `Sell — ${holder.name} · ${stock?.symbol}` : ''}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          Available shares: <strong className="text-gray-900 dark:text-white">{fmt.number(maxQty, 4)}</strong>
          <span className="mx-2">·</span>
          Avg buy price: <strong className="text-gray-900 dark:text-white">{fmt.currency(holder?.avg_buy_price)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity to Sell</label>
            <div className="flex gap-2">
              <input type="number" className="input" min="0.0001" max={maxQty} step="0.0001" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
              <button type="button" onClick={() => setForm(f => ({ ...f, quantity: maxQty }))}
                className="btn-secondary px-3 flex-shrink-0 text-xs whitespace-nowrap">
                Sell All
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Max: {fmt.number(maxQty, 4)}</p>
          </div>
          <div>
            <label className="label">Sell Price (₹)</label>
            <input type="number" className="input" min="0.01" step="0.01" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div className="col-span-2">
            <label className="label">Sell Date &amp; Time</label>
            <input type="date" className="input [color-scheme:light] dark:[color-scheme:dark]" value={form.executed_at}
              onChange={e => setForm(f => ({ ...f, executed_at: e.target.value }))} required />
          </div>
        </div>
        {form.quantity && form.price && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-orange-700 dark:text-orange-400 space-y-1">
            <div>Sale value: <strong>{fmt.currency(parseFloat(form.quantity) * parseFloat(form.price))}</strong></div>
            <div>P&amp;L on this sale: <strong className={pnlColor(parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0))}>
              {pnlSign(parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0))}
              {fmt.currency((parseFloat(form.price) - parseFloat(holder?.avg_buy_price || 0)) * parseFloat(form.quantity))}
            </strong></div>
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

function SellAllModal({ stock, holders, open, onClose, onDone }) {
  const activeHolders = holders.filter(h => h.status === 'active');
  const [form, setForm] = useState({ price: '', executed_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !stock) return;
    setForm({ price: stock.current_price, executed_at: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() });
    setError('');
  }, [open, stock]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await Promise.all(activeHolders.map(h =>
        api.post(`/portfolio/${h.id}/trade`, {
          stock_id: stock.id,
          type: 'sell',
          quantity: parseFloat(h.quantity),
          price: parseFloat(form.price),
          executed_at: form.executed_at || undefined,
          notes: 'Bulk sell all shares',
        })
      ));
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
              <div>Total shares to sell: <strong className="text-gray-900 dark:text-white">{fmt.number(totalShares, 4)}</strong></div>
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
            </div>
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

function HoldersModal({ stock, open, onClose, onEdit, onReload, showToast }) {
  const [holders, setHolders] = useState([]);
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

  const loadHolders = () => {
    if (!stock) return;
    setLoading(true);
    api.get(`/stocks/${stock.id}/holders`)
      .then(r => setHolders(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const toggleSettled = async (field, value) => {
    try {
      await api.put(`/stocks/${stock.id}`, { [field]: value });
      if (onReload) onReload();
      onClose();
      const label = field === 'investment_settled' ? 'Investment' : 'P/L';
      if (showToast) showToast(`${label} marked as ${value ? 'settled' : 'unsettled'}`);
    } catch (err) { alert(err.message); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/portfolio/${deleteHolder.id}/holding/${stock.id}`);
      setDeleteHolder(null);
      loadHolders();
    } catch (err) { alert(err.message); } finally { setDeleting(false); }
  };

  useEffect(() => {
    if (!open || !stock) return;
    setInvestmentSettled(!!stock.investment_settled);
    setPnlSettled(!!stock.pnl_settled);
    loadHolders();
  }, [open, stock]);

  const totalInvested = holders.reduce((s, h) => s + parseFloat(h.invested_amount), 0);
  const totalValue = holders.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const allExited = holders.length > 0 && holders.every(h => h.status === 'exited');
  const totalSoldPnl = holders.reduce((s, h) => s + parseFloat(h.realized_pnl || 0), 0);
  const totalBuyAmount = holders.reduce((s, h) => s + parseFloat(h.total_buy_amount || 0), 0);
  const soldPnlPct = totalBuyAmount > 0 ? (totalSoldPnl / totalBuyAmount) * 100 : 0;

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

  const displayed = holders
    .filter(h => filterStatus === 'all' || h.status === filterStatus)
    .filter(h => filterType === 'all' || h.user_type === filterType)
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

  return (
    <>
      <Modal open={open} onClose={onClose} title={stock ? `Investors — ${stock.symbol} · ${stock.name}` : ''} size="xl"
        headerAction={stock && (
          <button onClick={() => { onClose(); onEdit(stock); }} className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors" title="Edit stock">
            <Edit2 size={16} />
          </button>
        )}>
        {loading ? <SkeletonTable rows={4} cols={9} /> : (
          <div className="space-y-4">
            <div className="flex items-center gap-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
            </div>
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Total Investors</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{holders.length}</p>
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
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setSellAllOpen(true)} className="btn-danger flex items-center gap-2">
                  <TrendingDown size={15} /> Sell All Shares
                </button>
                <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2">
                  <ShoppingCart size={15} /> Add Investment
                </button>
              </div>
            </div>
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
            {holders.length === 0 ? (
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
                    <SortTh label="Avg Buy Price" col="avg_buy_price" />
                    <SortTh label="Amount Invested" col="invested_amount" />
                    <SortTh label="Current Value" col="current_value" />
                    <SortTh label="P&L" col="pnl" />
                    <SortTh label="P&L %" col="pnl_pct" />
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
                        <Td className="font-bold text-gray-900 dark:text-white">{fmt.number(totQty, 4)}</Td>
                        <Td>—</Td>
                        <Td>—</Td>
                        <Td className="font-bold text-gray-900 dark:text-white">{fmt.currency(totInvested)}</Td>
                        <Td className="font-bold text-gray-900 dark:text-white">{totCurrent > 0 ? fmt.currency(totCurrent) : '—'}</Td>
                        <Td><span className={pnlColor(totPnl)}>{pnlSign(totPnl)}{fmt.currency(totPnl)}</span></Td>
                        <Td colSpan={2}><span className={pnlColor(totPnl / totInvested * 100)}>{pnlSign(totPnl / totInvested * 100)}{fmt.percent(Math.abs(totPnl / totInvested * 100))}</span></Td>
                      </tr>
                    );
                  })()}
                  {displayed.map(h => (
                    <tr key={h.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${h.status === 'exited' ? 'opacity-60' : ''}`}>
                      <Td>
                        <p className="font-medium text-gray-900 dark:text-white">{h.name}</p>
                        <p className="text-xs text-gray-500">{h.email}</p>
                      </Td>
                      <Td><span className={h.user_type === 'shareholder' ? 'badge-blue' : 'badge-gray'}>{h.user_type}</span></Td>
                      <Td><span className={h.status === 'active' ? 'badge-green' : 'badge-red'}>{h.status}</span></Td>
                      <Td className="font-medium">{fmt.number(h.status === 'exited' ? h.total_bought_quantity : h.quantity, 4)}</Td>
                      <Td className="text-xs text-gray-500 whitespace-nowrap">{h.first_buy_date ? fmt.date(h.first_buy_date) : '—'}</Td>
                      <Td>{fmt.currency(h.avg_buy_price)}</Td>
                      <Td>{fmt.currency(h.invested_amount)}</Td>
                      <Td className="font-medium">{h.status === 'active' ? fmt.currency(h.current_value) : '—'}</Td>
                      <Td>
                        {h.status === 'active'
                          ? <span className={pnlColor(h.unrealized_pnl)}>{pnlSign(h.unrealized_pnl)}{fmt.currency(h.unrealized_pnl)}</span>
                          : <span className={pnlColor(h.realized_pnl)}>{pnlSign(h.realized_pnl)}{fmt.currency(h.realized_pnl)}</span>
                        }
                      </Td>
                      <Td>
                        {h.status === 'active'
                          ? <span className={pnlColor(h.pnl_percent)}>{pnlSign(h.pnl_percent)}{fmt.percent(h.pnl_percent)}</span>
                          : (() => {
                              const buyAmt = parseFloat(h.total_buy_amount);
                              const pct = buyAmt > 0 ? ((parseFloat(h.realized_pnl) / buyAmt) * 100) : 0;
                              return <span className={pnlColor(pct)}>{pnlSign(pct)}{fmt.percent(pct)}</span>;
                            })()
                        }
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          {h.status === 'active' && (
                            <button onClick={() => setSellHolder(h)} className="p-1 text-gray-400 hover:text-orange-600" title="Sell shares">
                              <TrendingDown size={14} />
                            </button>
                          )}
                          <button onClick={() => setEditHolder(h)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit holding">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteHolder(h)} className="p-1 text-gray-400 hover:text-red-600" title="Remove holding">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        )}
      </Modal>
      <AddInvestmentModal stock={stock} open={addOpen} onClose={() => setAddOpen(false)} onDone={loadHolders} />
      <SellAllModal stock={stock} holders={holders} open={sellAllOpen} onClose={() => setSellAllOpen(false)} onDone={loadHolders} />
      <SellModal stock={stock} holder={sellHolder} open={!!sellHolder} onClose={() => setSellHolder(null)} onDone={loadHolders} />
      <EditHoldingModal stock={stock} holder={editHolder} open={!!editHolder} onClose={() => setEditHolder(null)} onDone={loadHolders} />
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
    </>
  );
}

export default function StocksPage() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [holdersStock, setHoldersStock] = useState(null);
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
  const [tableSort, setTableSort] = useState({ key: 'symbol', dir: 'asc' });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    setLoading(true);
    api.get('/stocks/all').then(r => setStocks(r.data)).catch(console.error).finally(() => setLoading(false));
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
    try { await api.delete(`/stocks/${deleteStock.id}`); setDeleteStock(null); setHoldersStock(null); load(); }
    catch (err) { alert(err.message); } finally { setDeleting(false); }
  };

  const fetchPriceIntoForm = async () => {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) { setError('Enter a symbol first'); return; }
    setError(''); setFetchingPrice(true);
    try {
      const stockId = selected?.id;
      let price, name;
      if (stockId) {
        const res = await api.post(`/stocks/${stockId}/fetch-price`, {});
        price = res.data.price;
        name = form.name;
        load();
      } else {
        const res = await api.post('/stocks/preview-price', { symbol: sym });
        price = res.data.price;
        name = res.data.name;
      }
      setForm(f => ({ ...f, current_price: price, name: f.name || name || f.name }));
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

  const sortedStocks = [...stocks].sort((a, b) => {
    const { key, dir } = tableSort;
    let av = a[key], bv = b[key];
    if (key === 'change') { av = parseFloat(a.current_price) - parseFloat(a.previous_close); bv = parseFloat(b.current_price) - parseFloat(b.previous_close); }
    if (key === 'period') { av = a.first_investment_date ? new Date(a.first_investment_date).getTime() : 0; bv = b.first_investment_date ? new Date(b.first_investment_date).getTime() : 0; }
    if (av == null || av === '') av = dir === 'asc' ? Infinity : -Infinity;
    if (bv == null || bv === '') bv = dir === 'asc' ? Infinity : -Infinity;
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return dir === 'asc' ? cmp : -cmp;
  });

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
        <Table>
          <thead>
            <tr>
              <SortThMain label="Symbol" col="symbol" />
              <SortThMain label="Name" col="name" />
              <SortThMain label="Sector" col="sector" />
              <SortThMain label="Current Price" col="current_price" />
              <SortThMain label="Buy Price" col="common_buy_price" />
              <SortThMain label="Period" col="period" />
              <SortThMain label="Holder" col="holder_name" />
              <SortThMain label="Investment Settled" col="investment_settled" />
              <SortThMain label="P/L Settled" col="pnl_settled" />
              <SortThMain label="Status" col="is_active" />
              <SortThMain label="Updated" col="last_updated" />
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {!sortedStocks.length && <EmptyRow cols={12} message="No stocks added yet" />}
            {sortedStocks.map(s => {
              const msg = refreshMsg[s.id];
              return (
                <>
                  <tr key={s.id} onClick={() => setHoldersStock(s)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                    <Td><span className="font-bold text-brand-600 dark:text-brand-400">{s.symbol}</span></Td>
                    <Td className="font-medium text-gray-900 dark:text-white">{s.name}</Td>
                    <Td><span className="badge-blue">{s.sector || '—'}</span></Td>
                    <Td className="font-medium">{fmt.currency(s.current_price)}</Td>
                    <Td className="text-xs text-gray-500 whitespace-nowrap">{s.common_buy_price ? fmt.currency(s.common_buy_price) : '—'}</Td>
                    <Td className="text-xs text-gray-500 whitespace-nowrap">{holdingPeriod(s.first_investment_date, s.last_sell_date)}</Td>
                    <Td onClick={e => e.stopPropagation()}>
                      {s.holder_name ? (
                        <button onClick={() => setHolderPickStock(s)} className="flex items-center gap-1.5 group">
                          <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {s.holder_name[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-600 truncate max-w-[80px]">{s.holder_name}</span>
                        </button>
                      ) : (
                        <button onClick={() => setHolderPickStock(s)} className="text-xs text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                          Assign
                        </button>
                      )}
                    </Td>
                    <Td className="text-center text-xs">{s.investment_settled ? <span className="badge-green">Settled</span> : <span className="text-gray-400">—</span>}</Td>
                    <Td className="text-center text-xs">{s.pnl_settled ? <span className="badge-green">Settled</span> : <span className="text-gray-400">—</span>}</Td>
                    <Td><span className={s.is_active ? 'badge-green' : 'badge-red'}>{s.is_active ? 'Active' : 'Inactive'}</span></Td>
                    <Td className="text-gray-500 text-xs">{s.last_updated ? fmt.datetime(s.last_updated) : '—'}</Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => refreshPrice(s)} disabled={refreshingId === s.id} className="p-1 text-gray-400 hover:text-green-600" title="Fetch live price">
                          {refreshingId === s.id ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        </button>
                        <button onClick={() => setHolderPickStock(s)} className={`p-1 transition-colors ${s.holder_id ? 'text-brand-500 hover:text-brand-700' : 'text-gray-400 hover:text-brand-600'}`} title="Assign stock holder">
                          <UserCheck size={15} />
                        </button>
                        <button onClick={() => toggleActive(s)} className={`text-xs px-2 py-0.5 rounded ${s.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                          {s.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => setDeleteStock(s)} className="p-1 text-gray-400 hover:text-red-600" title="Delete stock">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </Td>
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

      <HoldersModal stock={holdersStock} open={!!holdersStock} onClose={() => setHoldersStock(null)} onEdit={openEdit} onReload={load} showToast={showToast} />
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
