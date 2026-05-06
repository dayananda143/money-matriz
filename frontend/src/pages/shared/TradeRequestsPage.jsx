import { useEffect, useState } from 'react';
import { Plus, X, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { fmt } from '../../utils/format';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', Icon: Clock },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   Icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           Icon: XCircle },
};

function StatusBadge({ status }) {
  const { label, cls, Icon } = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

// ── Edit Request Modal ───────────────────────────────────────────────────────
function EditModal({ request, onClose, onSaved }) {
  const [form, setForm] = useState({
    stock_symbol: request.stock_symbol,
    stock_name: request.stock_name || '',
    quantity: parseFloat(request.quantity).toFixed(2),
    buy_price: parseFloat(request.buy_price).toFixed(2),
    amount: parseFloat(request.amount).toFixed(2),
    notes: request.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => {
    const next = { ...form, [k]: v };
    if ((k === 'quantity' || k === 'buy_price') && next.quantity && next.buy_price) {
      next.amount = (parseFloat(next.quantity) * parseFloat(next.buy_price)).toFixed(2);
    } else if (k === 'amount' && next.amount && next.buy_price) {
      next.quantity = (parseFloat(next.amount) / parseFloat(next.buy_price)).toFixed(2);
    }
    setForm(next);
  };

  const submit = async () => {
    setError('');
    if (!form.stock_symbol || !form.quantity || !form.buy_price || !form.amount) {
      setError('Stock symbol, quantity, buy price and amount are required.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/trade-requests/${request.id}`, form);
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edit Trade Request</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stock Symbol *</label>
              <input value={form.stock_symbol} onChange={e => set('stock_symbol', e.target.value.toUpperCase())} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stock Name</label>
              <input value={form.stock_name} onChange={e => set('stock_name', e.target.value)} placeholder="Optional" className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantity *</label>
              <input type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buy Price *</label>
              <input type="number" min="0" value={form.buy_price} onChange={e => set('buy_price', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Total Amount *</label>
            <input type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="input w-full resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Submit Request Modal ─────────────────────────────────────────────────────
function SubmitModal({ onClose, onSubmitted }) {
  const [form, setForm] = useState({ stock_symbol: '', stock_name: '', quantity: '', buy_price: '', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [symbolStatus, setSymbolStatus] = useState('idle'); // idle | checking | valid | invalid
  const symbolTimer = useState(null);

  const set = (k, v) => {
    const next = { ...form, [k]: v };
    if ((k === 'quantity' || k === 'buy_price') && next.quantity && next.buy_price) {
      next.amount = (parseFloat(next.quantity) * parseFloat(next.buy_price)).toFixed(2);
    } else if (k === 'amount' && next.amount && next.buy_price) {
      next.quantity = (parseFloat(next.amount) / parseFloat(next.buy_price)).toFixed(2);
    }
    setForm(next);

    if (k === 'stock_symbol') {
      const sym = v.trim();
      if (!sym) { setSymbolStatus('idle'); return; }
      setSymbolStatus('checking');
      if (symbolTimer[0]) clearTimeout(symbolTimer[0]);
      symbolTimer[0] = setTimeout(() => {
        api.get(`/stocks/lookup?symbol=${sym}`)
          .then(r => {
            setForm(f => ({ ...f, stock_name: r.data.name || f.stock_name }));
            setSymbolStatus('valid');
          })
          .catch(() => setSymbolStatus('invalid'));
      }, 800);
    }
  };

  const submit = async () => {
    setError('');
    if (!form.stock_symbol || !form.quantity || !form.buy_price || !form.amount) {
      setError('Stock symbol, quantity, buy price and amount are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/trade-requests', form);
      onSubmitted();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Submit Trade Request</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stock Symbol *</label>
              <div className="relative">
                <input value={form.stock_symbol} onChange={e => set('stock_symbol', e.target.value.toUpperCase())}
                  placeholder="e.g. RELIANCE"
                  className={`input w-full pr-7 ${symbolStatus === 'invalid' ? 'border-red-400 dark:border-red-600' : symbolStatus === 'valid' ? 'border-green-400 dark:border-green-600' : ''}`} />
                {symbolStatus === 'checking' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">…</span>}
                {symbolStatus === 'valid' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 text-sm">✓</span>}
                {symbolStatus === 'invalid' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 text-sm">✗</span>}
              </div>
              {symbolStatus === 'invalid' && <p className="text-xs text-red-500 mt-1">Symbol not found on Yahoo Finance</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stock Name</label>
              <input value={form.stock_name} onChange={e => set('stock_name', e.target.value)}
                placeholder={symbolStatus === 'checking' ? 'Fetching…' : 'Auto-filled or enter manually'} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantity *</label>
              <input type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)}
                placeholder="0" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buy Price *</label>
              <input type="number" min="0" value={form.buy_price} onChange={e => set('buy_price', e.target.value)}
                placeholder="0.00" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Total Amount *</label>
            <input type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="Auto-calculated" className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes..." rows={2} className="input w-full resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving || symbolStatus === 'checking' || symbolStatus === 'invalid'} className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Submitting…' : 'Submit Request'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Approve Modal ────────────────────────────────────────────────────────────
function ApproveModal({ request, onClose, onApproved }) {
  const [stocks, setStocks] = useState([]);
  const [stockMatch, setStockMatch] = useState(null); // existing stock or null
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [form, setForm] = useState({
    stock_id: '',
    stock_symbol: request.stock_symbol,
    stock_name: request.stock_name || request.stock_symbol,
    stock_sector: '',
    quantity: parseFloat(request.quantity).toFixed(2),
    price: parseFloat(request.buy_price).toFixed(2),
    total: parseFloat(request.amount).toFixed(2),
    notes: request.notes || '',
    executed_at: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/stocks/all').then(r => {
      setStocks(r.data);
      const match = r.data.find(s => s.symbol === request.stock_symbol);
      if (match) {
        setStockMatch(match);
        setForm(f => ({ ...f, stock_id: match.id }));
      } else {
        // Auto-lookup name and sector from Yahoo Finance
        setLookingUp(true);
        api.get(`/stocks/lookup?symbol=${request.stock_symbol}`)
          .then(r => {
            setForm(f => ({
              ...f,
              stock_name: r.data.name || f.stock_name,
              stock_sector: r.data.sector || '',
            }));
          })
          .catch(() => setLookupFailed(true))
          .finally(() => setLookingUp(false));
      }
    }).catch(() => {});
  }, []);

  const set = (k, v) => {
    const next = { ...form, [k]: v };
    if ((k === 'quantity' || k === 'price') && next.quantity && next.price) {
      next.total = (parseFloat(next.quantity) * parseFloat(next.price)).toFixed(2);
    }
    setForm(next);
  };

  const submit = async () => {
    setError('');
    if (!form.quantity || !form.price) {
      setError('Quantity and price are required.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/trade-requests/${request.id}/approve`, {
        ...form,
        executed_at: form.executed_at ? new Date(form.executed_at).toISOString() : undefined,
      });
      onApproved();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Approve Trade Request</h3>
            <p className="text-xs text-gray-400 mt-0.5">{request.user_name} · {request.stock_symbol}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stock</label>
            {stockMatch ? (
              <div className="input w-full bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="font-semibold">{stockMatch.symbol}</span>
                <span className="text-gray-400">—</span>
                <span>{stockMatch.name}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${lookupFailed ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'}`}>
                  {lookingUp ? 'Looking up stock info…' : lookupFailed ? 'Stock not found on Yahoo Finance — cannot approve. Fix the symbol first.' : 'New stock — will be created automatically'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Symbol</label>
                    <input value={form.stock_symbol} onChange={e => set('stock_symbol', e.target.value.toUpperCase())} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input value={form.stock_name} onChange={e => set('stock_name', e.target.value)} placeholder={lookingUp ? 'Fetching…' : ''} className="input w-full" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sector</label>
                  <input value={form.stock_sector} onChange={e => set('stock_sector', e.target.value)} placeholder={lookingUp ? 'Fetching…' : 'e.g. Technology'} className="input w-full" />
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bought Price *</label>
              <input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantity *</label>
              <input type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bought Date</label>
            <input type="date" value={form.executed_at} onChange={e => set('executed_at', e.target.value)} className="input w-full" />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving || lookingUp || (!stockMatch && lookupFailed)} className="btn-primary flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Approving…' : 'Approve & Create Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ request, onClose, onRejected }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.put(`/trade-requests/${request.id}/reject`, { rejection_reason: reason });
      onRejected();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reject Request</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Rejecting <span className="font-medium text-gray-900 dark:text-white">{request.stock_symbol}</span> request from <span className="font-medium text-gray-900 dark:text-white">{request.user_name}</span>.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reason (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Explain why this request is rejected…" rows={3} className="input w-full resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
            {saving ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({ req, currentUser, canReview, onApprove, onReject, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isOwn = req.user_id === currentUser.id;
  const canEdit = (isOwn && req.status === 'pending') || isAdmin;
  const canDelete = isAdmin || isOwn;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 p-4">
        {/* Symbol badge */}
        <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-xs flex-shrink-0">
          {req.stock_symbol.slice(0, 3)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 dark:text-white text-sm">{req.stock_symbol}</p>
            {req.stock_name && <p className="text-xs text-gray-400 truncate">{req.stock_name}</p>}
            <StatusBadge status={req.status} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {fmt.number(req.quantity, 2)} shares · {fmt.currency(req.buy_price)}/share · {fmt.currency(req.amount)} total
          </p>
          {canReview && (
            <p className="text-xs text-gray-400 mt-0.5">By <span className="font-medium text-gray-600 dark:text-gray-300">{req.user_name}</span></p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canReview && req.status === 'pending' && (
            <>
              <button onClick={() => onApprove(req)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors border border-green-200 dark:border-green-800">
                <CheckCircle2 size={13} /> Approve
              </button>
              <button onClick={() => onReject(req)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800">
                <XCircle size={13} /> Reject
              </button>
            </>
          )}
          {canEdit && (
            <button onClick={() => onEdit(req)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(req)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 space-y-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><p className="text-gray-400">Quantity</p><p className="font-medium text-gray-900 dark:text-white">{fmt.number(req.quantity, 4)}</p></div>
            <div><p className="text-gray-400">Buy Price</p><p className="font-medium text-gray-900 dark:text-white">{fmt.currency(req.buy_price)}</p></div>
            <div><p className="text-gray-400">Amount</p><p className="font-medium text-gray-900 dark:text-white">{fmt.currency(req.amount)}</p></div>
            <div><p className="text-gray-400">Submitted</p><p className="font-medium text-gray-900 dark:text-white">{fmt.date(req.created_at)}</p></div>
          </div>
          {req.notes && (
            <p className="text-xs text-gray-600 dark:text-gray-300 pt-1"><span className="text-gray-400">Notes: </span>{req.notes}</p>
          )}
          {req.status === 'rejected' && req.rejection_reason && (
            <p className="text-xs text-red-600 dark:text-red-400 pt-1"><span className="font-medium">Rejection reason: </span>{req.rejection_reason}</p>
          )}
          {req.reviewed_by_name && (
            <p className="text-xs text-gray-400 pt-1">Reviewed by <span className="font-medium text-gray-600 dark:text-gray-300">{req.reviewed_by_name}</span> on {fmt.date(req.reviewed_at)}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ request, onClose, onDeleted }) {
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.delete(`/trade-requests/${request.id}`);
      onDeleted();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete Request</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Delete <span className="font-medium text-gray-900 dark:text-white">{request.stock_symbol}</span> request from <span className="font-medium text-gray-900 dark:text-white">{request.user_name}</span>? This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
            {saving ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TradeRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showSubmit, setShowSubmit] = useState(false);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isShareholder = user.user_type === 'shareholder';
  const canReview = isAdmin;

  const load = () => {
    setLoading(true);
    api.get(`/trade-requests?status=${filter}`)
      .then(r => setRequests(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const pending  = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Trade Requests</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {canReview ? 'Review and approve incoming trade requests' : 'Submit trade requests for admin approval'}
          </p>
        </div>
        {!canReview && (
          <button onClick={() => setShowSubmit(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Request
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {['pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === s ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {s}
            {s === 'pending' && pending > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-medium text-gray-600 dark:text-gray-300">No {filter} requests</p>
          {!canReview && filter === 'pending' && (
            <p className="text-sm text-gray-400 mt-1">
              <button onClick={() => setShowSubmit(true)} className="text-brand-600 hover:underline">Submit a new request</button> to get started.
            </p>
          )}
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map(r => (
            <RequestCard key={r.id} req={r} currentUser={user} canReview={canReview}
              onApprove={setApproving} onReject={setRejecting}
              onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showSubmit && (
        <SubmitModal onClose={() => setShowSubmit(false)} onSubmitted={() => { setShowSubmit(false); load(); }} />
      )}
      {approving && (
        <ApproveModal request={approving} onClose={() => setApproving(null)} onApproved={() => { setApproving(null); load(); }} />
      )}
      {rejecting && (
        <RejectModal request={rejecting} onClose={() => setRejecting(null)} onRejected={() => { setRejecting(null); load(); }} />
      )}
      {editing && (
        <EditModal request={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {deleting && (
        <ConfirmDeleteModal request={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); load(); }} />
      )}
    </div>
  );
}
