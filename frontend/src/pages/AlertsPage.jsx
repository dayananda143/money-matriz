import { useEffect, useState, useCallback } from 'react';
import { BellRing, TrendingDown, TrendingUp, Trash2, Pencil, RefreshCw, FlaskConical } from 'lucide-react';
import api from '../api';
import { fmt } from '../utils/format';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function EditAlertModal({ alert, open, onClose, onSaved }) {
  const [form, setForm] = useState({ stop_loss: '', target: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !alert) return;
    setForm({
      stop_loss: alert.stop_loss ? parseFloat(alert.stop_loss).toFixed(2) : '',
      target: alert.target ? parseFloat(alert.target).toFixed(2) : '',
    });
    setError('');
    setSaving(false);
  }, [open, alert]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.stop_loss && !form.target) { setError('Enter at least stop loss or target'); return; }
    setError(''); setSaving(true);
    try {
      await api.post('/stock-alerts', {
        stock_id: alert.stock_id,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        target: form.target ? parseFloat(form.target) : null,
      });
      onSaved();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Alert — ${alert?.symbol}`}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
        {alert?.current_price && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current price: <strong className="text-gray-900 dark:text-white">₹{parseFloat(alert.current_price).toFixed(2)}</strong>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Stop Loss (₹)</label>
            <input type="number" className="input" min="0.01" step="0.01" placeholder="e.g. 150.00"
              value={form.stop_loss} onChange={e => setForm(f => ({ ...f, stop_loss: e.target.value }))} />
            <p className="text-xs text-red-500 mt-1">Notify when price ≤ this</p>
          </div>
          <div>
            <label className="label">Target (₹)</label>
            <input type="number" className="input" min="0.01" step="0.01" placeholder="e.g. 250.00"
              value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
            <p className="text-xs text-green-500 mt-1">Notify when price ≥ this</p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AlertsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editAlert, setEditAlert] = useState(null);
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/stock-alerts')
      .then(r => setAlerts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (alert) => {
    setTogglingId(alert.stock_id);
    try {
      const res = await api.patch(`/stock-alerts/${alert.stock_id}/toggle`);
      setAlerts(prev => prev.map(a => a.stock_id === alert.stock_id ? { ...a, is_active: res.data.is_active } : a));
    } catch (err) { console.error(err); }
    finally { setTogglingId(null); }
  };

  const remove = async (alert) => {
    if (!confirm(`Remove alert for ${alert.symbol}?`)) return;
    setDeletingId(alert.stock_id);
    try {
      await api.delete(`/stock-alerts/${alert.stock_id}`);
      setAlerts(prev => prev.filter(a => a.stock_id !== alert.stock_id));
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  const sendTest = async (type) => {
    setTestSending(true); setTestMsg('');
    try {
      await api.post('/notifications/test', { type });
      setTestMsg(`Test ${type === 'stop_loss' ? 'stop loss' : 'target'} notification sent!`);
      setTimeout(() => setTestMsg(''), 3000);
    } catch (err) { setTestMsg('Failed: ' + err.message); }
    finally { setTestSending(false); }
  };

  const activeCount = alerts.filter(a => a.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <BellRing size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stock Alerts</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {activeCount} of {alerts.length} alert{alerts.length !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              {testMsg && <span className="text-xs text-green-600 dark:text-green-400 font-medium">{testMsg}</span>}
              <button onClick={() => sendTest('stop_loss')} disabled={testSending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Send a test stop loss notification to yourself">
                <FlaskConical size={13} /> Test SL
              </button>
              <button onClick={() => sendTest('target')} disabled={testSending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                title="Send a test target notification to yourself">
                <FlaskConical size={13} /> Test Target
              </button>
            </>
          )}
          <button onClick={load} className="btn-secondary p-2" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <BellRing size={44} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No alerts set</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Open any stock from the Stocks page and set a stop loss or target to create an alert.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const price = parseFloat(alert.current_price || 0);
            const sl = alert.stop_loss ? parseFloat(alert.stop_loss) : null;
            const tgt = alert.target ? parseFloat(alert.target) : null;
            const slTriggered = sl && price <= sl;
            const tgtTriggered = tgt && price >= tgt;

            return (
              <div
                key={alert.stock_id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  alert.is_active
                    ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-60'
                }`}
              >
                {/* Stock info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-brand-600 dark:text-brand-400 text-sm">{alert.symbol}</span>
                    <span className="text-xs text-gray-400 truncate">{alert.name}</span>
                    {!alert.is_active && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Paused</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Current price */}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {fmt.currency(price)}
                    </span>

                    {/* Stop loss */}
                    {sl && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${slTriggered ? 'text-red-600 dark:text-red-400' : 'text-red-400 dark:text-red-500'}`}>
                        <TrendingDown size={13} />
                        SL: ₹{sl.toFixed(2)}
                        {slTriggered && <span className="ml-1 px-1 py-0.5 bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400">Triggered</span>}
                      </div>
                    )}

                    {/* Target */}
                    {tgt && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${tgtTriggered ? 'text-green-600 dark:text-green-400' : 'text-green-500 dark:text-green-600'}`}>
                        <TrendingUp size={13} />
                        Target: ₹{tgt.toFixed(2)}
                        {tgtTriggered && <span className="ml-1 px-1 py-0.5 bg-green-100 dark:bg-green-900/30 rounded text-green-600 dark:text-green-400">Reached</span>}
                      </div>
                    )}

                    {/* Set by */}
                    {alert.created_by_name && (
                      <span className="text-xs text-gray-400">by {alert.created_by_name}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => setEditAlert(alert)}
                    className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    title="Edit alert"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(alert)}
                    disabled={deletingId === alert.stock_id}
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Delete alert"
                  >
                    <Trash2 size={15} />
                  </button>
                  <Toggle
                    checked={alert.is_active}
                    onChange={() => togglingId !== alert.stock_id && toggle(alert)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditAlertModal
        alert={editAlert}
        open={!!editAlert}
        onClose={() => setEditAlert(null)}
        onSaved={load}
      />
    </div>
  );
}
