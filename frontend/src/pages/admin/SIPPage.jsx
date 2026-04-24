import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  RefreshCw, Plus, Trash2, CalendarClock, Pencil,
  ArrowLeft, ChevronLeft, ChevronRight, Users, UserPlus, X, ChevronUp, ChevronDown, Copy, Check, Columns, Download,
} from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

async function exportSIPToPDF({ entries, shareholderInfo, summary, visibleCols }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const GREEN_DARK = [22, 78, 45];
  const GREEN_PALE = [240, 250, 244];
  const GOLD = [192, 155, 60];
  const WHITE = [255, 255, 255];

  doc.setFillColor(...WHITE);
  doc.rect(0, 0, W, H, 'F');

  const BANNER_H = 28;
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, W, BANNER_H, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, BANNER_H, W, 1, 'F');

  try {
    const logoDataUrl = await new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); };
      img.onerror = reject; img.src = '/logo.png';
    });
    doc.addImage(logoDataUrl, 'PNG', 4, 3, 22, 22);
  } catch {}

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text('MONEY MATRIZ — SIP LEDGER', 32, 12);
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(shareholderInfo?.name?.toUpperCase() || 'SHAREHOLDER', 32, 22);

  doc.setFillColor(...GREEN_PALE);
  doc.rect(0, BANNER_H + 1, W, 7, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, W - 10, BANNER_H + 6, { align: 'right' });

  // Summary strip
  const sumY = BANNER_H + 10;
  const cols4 = [
    { label: 'Total SIP', value: fmt.currency(summary.total) },
    { label: 'SIP', value: fmt.currency(summary.sipTotal) },
    { label: 'Additional', value: fmt.currency(summary.additionalTotal) },
    { label: 'Withdrawals', value: fmt.currency(summary.withdrawTotal) },
  ];
  const boxW = (W - 20) / cols4.length;
  cols4.forEach((col, i) => {
    const x = 10 + i * boxW;
    doc.setFillColor(...GREEN_PALE);
    doc.roundedRect(x, sumY, boxW - 2, 12, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREEN_DARK);
    doc.text(col.value, x + (boxW - 2) / 2, sumY + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(110, 110, 110);
    doc.text(col.label, x + (boxW - 2) / 2, sumY + 9.5, { align: 'center' });
  });

  const head = ['Date'];
  if (visibleCols.has('type')) head.push('Type');
  if (visibleCols.has('stock')) head.push('Symbol', 'Stock Name');
  if (visibleCols.has('amount')) head.push('Amount');
  if (visibleCols.has('notes')) head.push('Notes');

  const body = entries.map(e => {
    const row = [fmt.date(e.start_date) || '—'];
    if (visibleCols.has('type')) row.push(e.sip_type || '—');
    if (visibleCols.has('stock')) { row.push(e.stock_symbol || '—'); row.push(e.stock_name || '—'); }
    if (visibleCols.has('amount')) row.push((e.sip_type === 'withdraw' ? '−' : '') + fmt.currency(e.amount));
    if (visibleCols.has('notes')) row.push(e.notes || '—');
    return row;
  });

  autoTable(doc, {
    startY: sumY + 15,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: GREEN_DARK, textColor: WHITE, fontSize: 6.5, fontStyle: 'bold', halign: 'center', cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 }, lineColor: [34, 120, 70], lineWidth: 0.3 },
    bodyStyles: { fontSize: 6.8, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, lineColor: [210, 230, 215], lineWidth: 0.2 },
    alternateRowStyles: { fillColor: GREEN_PALE },
    didParseCell: (data) => {
      if (data.section === 'body' && head[data.column.index] === 'Type' && data.cell.raw === 'withdraw') {
        data.cell.styles.textColor = [200, 30, 30];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && head[data.column.index] === 'Amount' && String(data.cell.raw).startsWith('−')) {
        data.cell.styles.textColor = [200, 30, 30];
      }
    },
  });

  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, H - 8, W, 8, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, H - 8, W, 0.8, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text('MONEY MATRIZ IS NOT REGISTERED BY SEBI', W / 2, H - 3, { align: 'center' });
  doc.setDrawColor(...GREEN_DARK);
  doc.setLineWidth(0.5);
  doc.rect(0.5, 0.5, W - 1, H - 1, 'S');

  const name = (shareholderInfo?.name || 'sip').replace(/\s+/g, '_').toLowerCase();
  doc.save(`sip_${name}_${new Date().getFullYear()}.pdf`);
}


// ── Tiles page (admin only) ───────────────────────────────────────────────────
export function SIPTilesPage() {
  const navigate = useNavigate();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addShOpen, setAddShOpen] = useState(false);
  const [allShareholders, setAllShareholders] = useState([]);
  const [addShId, setAddShId] = useState('');
  const [addShSaving, setAddShSaving] = useState(false);

  // Bulk entry state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkType, setBulkType] = useState('sip');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkAmounts, setBulkAmounts] = useState({}); // { [id]: amount string }
  const [bulkSelected, setBulkSelected] = useState({}); // { [id]: boolean }
  const [bulkSaveDefaults, setBulkSaveDefaults] = useState(true);
  const [sipTypes, setSipTypes] = useState([]);
  const [bulkPosting, setBulkPosting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { ok: [...], fail: [...] }

  // Active / Inactive tab
  const [tab, setTab] = useState('active');

  // Inline default-amount editing on tiles
  const [editDefaultId, setEditDefaultId] = useState(null);
  const [editDefaultVal, setEditDefaultVal] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/sip/participants')
      .then(r => setParticipants(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!addShOpen) return;
    api.get('/users?type=shareholder').then(r => setAllShareholders(r.data)).catch(console.error);
  }, [addShOpen]);

  useEffect(() => {
    if (!bulkOpen) return;
    api.get('/config').then(r => setSipTypes(r.data.sip_types || [])).catch(console.error);
    // Pre-fill amounts from stored defaults; select all active participants by default
    setBulkAmounts(Object.fromEntries(filteredParticipants.map(p => [p.id, p.default_amount ? String(p.default_amount) : ''])));
    setBulkSelected(Object.fromEntries(filteredParticipants.map(p => [p.id, true])));
    setBulkResult(null);
  }, [bulkOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddShareholder = async (e) => {
    e.preventDefault();
    if (!addShId) return;
    setAddShSaving(true);
    try {
      await api.post('/sip/participants', { shareholder_id: addShId });
      const r = await api.get('/sip/participants');
      setParticipants(r.data);
      setAddShOpen(false);
      setAddShId('');
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setAddShSaving(false); }
  };

  const handleRemoveShareholder = async (sh) => {
    if (!confirm(`Remove ${sh.name} from SIP tracking? Their SIP plans will not be deleted.`)) return;
    try {
      await api.delete(`/sip/participants/${sh.id}`);
      setParticipants(prev => prev.filter(p => p.id !== sh.id));
    } catch (err) { alert(err.response?.data?.error || err.message); }
  };

  const handleBulkPost = async () => {
    const toPost = participants.filter(p => bulkSelected[p.id] && bulkAmounts[p.id] && parseFloat(bulkAmounts[p.id]) > 0);
    if (toPost.length === 0) { alert('Enter at least one amount.'); return; }
    setBulkPosting(true);
    setBulkResult(null);
    const ok = [], fail = [];
    await Promise.all(toPost.map(async (p) => {
      try {
        await api.post('/sip', {
          shareholder_id: p.id,
          amount: parseFloat(bulkAmounts[p.id]),
          start_date: bulkDate || null,
          sip_type: bulkType || null,
          notes: bulkNotes || null,
        });
        // Save as new default if checkbox checked and value changed
        if (bulkSaveDefaults && String(p.default_amount || '') !== bulkAmounts[p.id]) {
          await api.patch(`/sip/participants/${p.id}`, { default_amount: parseFloat(bulkAmounts[p.id]) }).catch(() => {});
        }
        ok.push(p.name);
      } catch (err) {
        fail.push({ name: p.name, error: err.response?.data?.error || err.message });
      }
    }));
    setBulkPosting(false);
    setBulkResult({ ok, fail });
    if (ok.length > 0) load();
  };

  const closeBulk = () => {
    setBulkOpen(false);
    setBulkDate('');
    setBulkType('sip');
    setBulkNotes('');
    setBulkAmounts({});
    setBulkSelected({});
    setBulkResult(null);
  };

  const saveEditDefault = async (p) => {
    const val = parseFloat(editDefaultVal);
    try {
      await api.patch(`/sip/participants/${p.id}`, { default_amount: val > 0 ? val : null });
      setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, default_amount: val > 0 ? val : null } : x));
    } catch (err) { alert(err.response?.data?.error || err.message); }
    setEditDefaultId(null);
  };

  const filteredParticipants = participants.filter(p => tab === 'active' ? p.is_active !== false : p.is_active === false);

  const totalBulk = filteredParticipants.reduce((s, p) => s + (bulkSelected[p.id] ? (parseFloat(bulkAmounts[p.id]) || 0) : 0), 0);
  const selectedCount = filteredParticipants.filter(p => bulkSelected[p.id]).length;
  const allSelected = filteredParticipants.length > 0 && selectedCount === filteredParticipants.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <CalendarClock size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">SIP Plans</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Systematic Investment Plans</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary p-2"><RefreshCw size={15} /></button>
          {participants.length > 0 && (
            <button onClick={() => setBulkOpen(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Plus size={15} /> Bulk Entry
            </button>
          )}
          <button onClick={() => setAddShOpen(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
            <UserPlus size={15} /> Add Shareholder
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!loading && participants.length > 0 && (
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {[['active', 'Active'], ['inactive', 'Inactive']].map(([key, label]) => {
            const count = participants.filter(p => key === 'active' ? p.is_active !== false : p.is_active === false).length;
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === key ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : participants.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No shareholders added yet.</p>
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No {tab} shareholders.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredParticipants.map(sh => (
            <div key={sh.id} className="flex items-center gap-2">
              <button onClick={() => navigate(`/sip/${sh.id}`)}
                className="flex-1 flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-sm transition-all text-left group">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-sm flex-shrink-0">
                  {sh.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{sh.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{sh.email}</p>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{sh.total_plans}</p>
                    <p className="text-xs text-gray-400">entries</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{fmt.currency(sh.total_invested)}</p>
                    <p className="text-xs text-gray-400">invested</p>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    {editDefaultId === sh.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus type="number" min="0" step="0.01"
                          value={editDefaultVal}
                          onChange={e => setEditDefaultVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditDefault(sh); if (e.key === 'Escape') setEditDefaultId(null); }}
                          className="input w-24 text-sm py-0.5 px-2 text-right" />
                        <button onClick={() => saveEditDefault(sh)} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditDefaultId(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditDefaultId(sh.id); setEditDefaultVal(sh.default_amount || ''); }}
                        className="text-right group/def">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover/def:text-brand-600 dark:group-hover/def:text-brand-400">
                          {sh.default_amount ? fmt.currency(sh.default_amount) : <span className="text-gray-300 dark:text-gray-600 text-xs">set default</span>}
                        </p>
                        <p className="text-xs text-gray-400">default/mo</p>
                      </button>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
                </div>
              </button>
              <button onClick={() => handleRemoveShareholder(sh)} title="Remove from SIP"
                className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors flex-shrink-0">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Shareholder Modal */}
      <Modal open={addShOpen} onClose={() => { setAddShOpen(false); setAddShId(''); }} title="Add Shareholder to SIP" size="sm">
        <form onSubmit={handleAddShareholder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Shareholder</label>
            <select value={addShId} onChange={e => setAddShId(e.target.value)} required className="input w-full">
              <option value="">Select shareholder...</option>
              {allShareholders
                .filter(sh => !participants.some(p => p.id === sh.id))
                .map(sh => <option key={sh.id} value={sh.id}>{sh.name} ({sh.email})</option>)
              }
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setAddShOpen(false); setAddShId(''); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addShSaving} className="btn-primary">{addShSaving ? 'Adding...' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Entry Modal */}
      <Modal open={bulkOpen} onClose={closeBulk} title="Bulk SIP Entry">
        <div className="space-y-4">
          {/* Shared fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date (shared)</label>
              <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type (shared)</label>
              <select value={bulkType} onChange={e => setBulkType(e.target.value)} className="input w-full">
                {sipTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (shared, optional)</label>
            <input type="text" value={bulkNotes} onChange={e => setBulkNotes(e.target.value)}
              placeholder="e.g. March 2026 SIP" className="input w-full" />
          </div>

          {/* Per-shareholder amounts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Select shareholders &amp; amounts</p>
              <button
                type="button"
                onClick={() => setBulkSelected(Object.fromEntries(filteredParticipants.map(p => [p.id, !allSelected])))}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredParticipants.map(p => (
                <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${bulkSelected[p.id] ? 'bg-brand-50 dark:bg-brand-900/10' : 'opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={!!bulkSelected[p.id]}
                    onChange={e => setBulkSelected(s => ({ ...s, [p.id]: e.target.checked }))}
                    className="w-4 h-4 rounded accent-brand-600 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-xs flex-shrink-0">
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white truncate">{p.name}</span>
                  </div>
                  <div className="relative flex-shrink-0 w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number" min="1" step="0.01"
                      value={bulkAmounts[p.id] || ''}
                      onChange={e => {
                        setBulkAmounts(a => ({ ...a, [p.id]: e.target.value }));
                        if (e.target.value) setBulkSelected(s => ({ ...s, [p.id]: true }));
                      }}
                      placeholder="0"
                      disabled={!bulkSelected[p.id]}
                      className="input w-full pl-7 text-right disabled:opacity-40"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total preview */}
          {totalBulk > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-brand-50 dark:bg-brand-900/10 rounded-lg">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {filteredParticipants.filter(p => bulkSelected[p.id] && parseFloat(bulkAmounts[p.id]) > 0).length} entries · total
              </span>
              <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{fmt.currency(totalBulk)}</span>
            </div>
          )}

          {/* Result feedback */}
          {bulkResult && (
            <div className="space-y-1">
              {bulkResult.ok.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 rounded-lg px-3 py-2">
                  <Check size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Posted for: {bulkResult.ok.join(', ')}</span>
                </div>
              )}
              {bulkResult.fail.length > 0 && (
                <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                  Failed: {bulkResult.fail.map(f => `${f.name} (${f.error})`).join(', ')}
                </div>
              )}
            </div>
          )}

          {!bulkResult && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={bulkSaveDefaults} onChange={e => setBulkSaveDefaults(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-600" />
              Save changed amounts as new defaults
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeBulk} className="btn-secondary">Close</button>
            {!bulkResult && (
              <button onClick={handleBulkPost} disabled={bulkPosting || totalBulk === 0} className="btn-primary flex items-center gap-1.5">
                {bulkPosting ? <><RefreshCw size={14} className="animate-spin" /> Posting...</> : <><Check size={14} /> Post Entries</>}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Detail page: transaction ledger for one shareholder ──────────────────────
export default function SIPPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shareholderId } = useParams();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isShareholder = user?.user_type === 'shareholder';
  const targetId = shareholderId ? parseInt(shareholderId) : (isShareholder ? user.id : null);

  const [entries, setEntries] = useState([]);
  const [shareholderInfo, setShareholderInfo] = useState(null);
  const [cashOnHand, setCashOnHand] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sipTypes, setSipTypes] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ stock_id: '', amount: '', date: '', sip_type: 'sip', notes: '' });
  const [stocks, setStocks] = useState([]);
  const [saving, setSaving] = useState(false);

  const [editEntry, setEditEntry] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editStocks, setEditStocks] = useState([]);

  const [deleteId, setDeleteId] = useState(null);
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [inlineRow, setInlineRow] = useState(null); // { stock_id, amount, date, sip_type, notes, _stocks }
  const [inlineSaving, setInlineSaving] = useState(false);
  const SIP_COLS = ['type', 'stock', 'amount', 'notes'];
  const SIP_COL_LABEL = { type: 'Type', stock: 'Stock', amount: 'Amount', notes: 'Notes' };
  const [sipVisibleCols, setSipVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('sip_visible_cols') || 'null'); return s ? new Set(s) : new Set(SIP_COLS); } catch { return new Set(SIP_COLS); }
  });
  const [sipColMenuOpen, setSipColMenuOpen] = useState(false);
  const toggleSipCol = col => setSipVisibleCols(prev => {
    const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col);
    localStorage.setItem('sip_visible_cols', JSON.stringify([...next])); return next;
  });

  const toggleSort = (col) => { setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' })); setPage(1); };

  const load = useCallback(() => {
    setLoading(true);
    const sipId = targetId || user?.id;
    Promise.all([
      api.get('/sip'),
      sipId ? api.get(`/sip/cash/${sipId}`).catch(() => ({ data: { cash_on_hand: 0 } })) : Promise.resolve({ data: { cash_on_hand: 0 } }),
    ]).then(([r, cashRes]) => {
        const all = r.data;
        const filtered = targetId ? all.filter(p => p.shareholder_id === targetId) : all;
        filtered.sort((a, b) => new Date(b.start_date || b.created_at) - new Date(a.start_date || a.created_at));
        setEntries(filtered);
        setCashOnHand(parseFloat(cashRes.data.cash_on_hand || 0));
        if (targetId && !shareholderInfo) {
          const match = filtered[0] || all.find(p => p.shareholder_id === targetId);
          if (match) setShareholderInfo({ id: targetId, name: match.shareholder_name, email: match.shareholder_email });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/config').then(r => setSipTypes(r.data.sip_types || [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    api.get(isAdmin ? '/stocks/all' : '/stocks').then(r => setStocks(r.data)).catch(console.error);
  }, [createOpen, isAdmin]);

  const withdrawTotal = entries.filter(e => e.sip_type === 'withdraw').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const depositTotal = entries.filter(e => e.sip_type !== 'withdraw').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const total = depositTotal - withdrawTotal;
  const sipTotal = entries.filter(e => e.sip_type === 'sip').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const additionalTotal = entries.filter(e => e.sip_type === 'additional').reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  const sortedEntries = [...entries].sort((a, b) => {
    let av, bv;
    if (sort.col === 'date') { av = new Date(a.start_date || a.created_at); bv = new Date(b.start_date || b.created_at); }
    else if (sort.col === 'type') { av = a.sip_type || ''; bv = b.sip_type || ''; }
    else if (sort.col === 'stock') { av = a.stock_symbol || ''; bv = b.stock_symbol || ''; }
    else if (sort.col === 'amount') { av = parseFloat(a.amount || 0); bv = parseFloat(b.amount || 0); }
    else { av = ''; bv = ''; }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedEntries.length / pageSize) || 1;
  const pagedEntries = sortedEntries.slice((page - 1) * pageSize, page * pageSize);

  const handleCreate = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = {
        stock_id: form.stock_id || null,
        amount: form.amount,
        start_date: form.date || null,
        sip_type: form.sip_type || null,
        notes: form.notes || null,
      };
      if (targetId) payload.shareholder_id = targetId;
      const res = await api.post('/sip', payload);
      setEntries(prev => [res.data, ...prev]);
      if (!shareholderInfo) setShareholderInfo({ id: targetId, name: res.data.shareholder_name, email: res.data.shareholder_email });
      setCreateOpen(false);
      setForm({ stock_id: '', amount: '', date: '', sip_type: 'sip', notes: '' });
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (entry) => {
    setEditEntry(entry);
    setEditForm({
      stock_id: entry.stock_id || '',
      amount: entry.amount,
      date: entry.start_date?.split('T')[0] || '',
      sip_type: entry.sip_type || 'sip',
      notes: entry.notes || '',
    });
    api.get(isAdmin ? '/stocks/all' : '/stocks').then(r => setEditStocks(r.data)).catch(console.error);
  };

  const handleEdit = async (ev) => {
    ev.preventDefault();
    setEditSaving(true);
    try {
      const payload = {
        stock_id: editForm.stock_id || '',
        amount: editForm.amount,
        start_date: editForm.date || null,
        sip_type: editForm.sip_type,
        notes: editForm.notes || null,
      };
      const res = await api.put(`/sip/${editEntry.id}`, payload);
      setEntries(prev => prev.map(e => e.id === editEntry.id ? res.data : e));
      setEditEntry(null);
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/sip/${deleteId}`);
      setEntries(prev => prev.filter(e => e.id !== deleteId));
      setDeleteId(null);
    } catch (err) { alert(err.response?.data?.error || err.message); }
  };

  const openCopy = async (entry) => {
    const stockList = editStocks.length ? editStocks
      : await api.get(isAdmin ? '/stocks/all' : '/stocks').then(r => r.data).catch(() => []);
    setInlineRow({
      stock_id: entry.stock_id || '',
      amount: entry.amount,
      date: entry.start_date?.split('T')[0] || '',
      sip_type: entry.sip_type || 'sip',
      notes: entry.notes || '',
      _stocks: stockList,
    });
  };

  const saveInline = async () => {
    if (!inlineRow) return;
    setInlineSaving(true);
    try {
      const payload = {
        stock_id: inlineRow.stock_id || null,
        amount: inlineRow.amount,
        start_date: inlineRow.date || null,
        sip_type: inlineRow.sip_type || null,
        notes: inlineRow.notes || null,
      };
      if (targetId) payload.shareholder_id = targetId;
      const res = await api.post('/sip', payload);
      setEntries(prev => [res.data, ...prev]);
      setInlineRow(null);
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setInlineSaving(false); }
  };

  const backTo = isAdmin && shareholderId ? '/sip' : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {backTo && (
          <button onClick={() => navigate(backTo)}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <CalendarClock size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {shareholderInfo ? `${shareholderInfo.name}'s SIP` : 'SIP'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {shareholderInfo ? shareholderInfo.email : 'SIP Transactions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary p-2"><RefreshCw size={15} /></button>
          {entries.length > 0 && (
            <button onClick={() => exportSIPToPDF({ entries: sortedEntries, shareholderInfo, summary: { total, sipTotal, additionalTotal, withdrawTotal }, visibleCols: sipVisibleCols }).catch(console.error)}
              className="btn-secondary flex items-center gap-1.5 text-sm">
              <Download size={14} /> Export PDF
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={15} /> Add Entry
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total SIP Amount</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt.currency(total)}</p>
            <p className="text-xs text-gray-400 mt-1">deposits − withdrawals</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">SIP Amount</p>
            <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{fmt.currency(sipTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{entries.filter(e => e.sip_type === 'sip').length} entries</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Additional Amount</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmt.currency(additionalTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{entries.filter(e => e.sip_type === 'additional').length} entries</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Withdrawals</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmt.currency(withdrawTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{entries.filter(e => e.sip_type === 'withdraw').length} entries</p>
          </div>
          {cashOnHand !== null && (
            <div className={`rounded-xl p-4 border ${cashOnHand >= 0 ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/40'}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cash on Hand</p>
              <p className={`text-xl font-bold ${cashOnHand >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmt.currency(cashOnHand)}</p>
              <p className="text-xs text-gray-400 mt-1">SIP − deployed</p>
            </div>
          )}
        </div>
      )}


      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Entries</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setSipColMenuOpen(o => !o)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <Columns size={12} /> Columns <span className="text-brand-600 dark:text-brand-400">{sipVisibleCols.size}</span>
                </button>
                {sipColMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-36">
                    {SIP_COLS.map(col => (
                      <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={sipVisibleCols.has(col)} onChange={() => toggleSipCol(col)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                        {SIP_COL_LABEL[col]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
                {[5, 10, 15].map(n => (
                  <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                    className={`px-2.5 py-1 transition-colors ${pageSize === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>
                  <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Date
                    <span className="flex flex-col leading-none">
                      <ChevronUp size={10} className={sort.col === 'date' && sort.dir === 'asc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} />
                      <ChevronDown size={10} className={sort.col === 'date' && sort.dir === 'desc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} />
                    </span>
                  </button>
                </Th>
                {sipVisibleCols.has('type') && <Th><button onClick={() => toggleSort('type')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">Type<span className="flex flex-col leading-none"><ChevronUp size={10} className={sort.col === 'type' && sort.dir === 'asc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} /><ChevronDown size={10} className={sort.col === 'type' && sort.dir === 'desc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} /></span></button></Th>}
                {sipVisibleCols.has('stock') && <Th><button onClick={() => toggleSort('stock')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">Stock<span className="flex flex-col leading-none"><ChevronUp size={10} className={sort.col === 'stock' && sort.dir === 'asc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} /><ChevronDown size={10} className={sort.col === 'stock' && sort.dir === 'desc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} /></span></button></Th>}
                {sipVisibleCols.has('amount') && <Th><button onClick={() => toggleSort('amount')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">Amount<span className="flex flex-col leading-none"><ChevronUp size={10} className={sort.col === 'amount' && sort.dir === 'asc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} /><ChevronDown size={10} className={sort.col === 'amount' && sort.dir === 'desc' ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'} /></span></button></Th>}
                {sipVisibleCols.has('notes') && <Th>Notes</Th>}
                {isAdmin && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {inlineRow && (
                <tr className="bg-brand-50 dark:bg-brand-900/10 border-b-2 border-brand-200 dark:border-brand-700">
                  <Td>
                    <input type="date" value={inlineRow.date}
                      onChange={e => setInlineRow(r => ({ ...r, date: e.target.value }))}
                      className="input w-full text-sm py-1 px-2" />
                  </Td>
                  {sipVisibleCols.has('type') && <Td>
                    <select value={inlineRow.sip_type}
                      onChange={e => setInlineRow(r => ({ ...r, sip_type: e.target.value }))}
                      className="input w-full text-sm py-1 px-2">
                      {sipTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </Td>}
                  {sipVisibleCols.has('stock') && <Td>
                    <select value={inlineRow.stock_id}
                      onChange={e => setInlineRow(r => ({ ...r, stock_id: e.target.value }))}
                      className="input w-full text-sm py-1 px-2">
                      <option value="">— None —</option>
                      {inlineRow._stocks.map(s => <option key={s.id} value={s.id}>{s.symbol}</option>)}
                    </select>
                  </Td>}
                  {sipVisibleCols.has('amount') && <Td>
                    <input type="number" min="1" step="0.01" value={inlineRow.amount}
                      onChange={e => setInlineRow(r => ({ ...r, amount: e.target.value }))}
                      className="input w-full text-sm py-1 px-2" />
                  </Td>}
                  {sipVisibleCols.has('notes') && <Td>
                    <input type="text" value={inlineRow.notes}
                      onChange={e => setInlineRow(r => ({ ...r, notes: e.target.value }))}
                      placeholder="Notes" className="input w-full text-sm py-1 px-2" />
                  </Td>}
                  <Td>
                    <div className="flex items-center gap-1">
                      <button onClick={saveInline} disabled={inlineSaving} title="Save"
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setInlineRow(null)} title="Cancel"
                        className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
              )}
              {sortedEntries.length === 0 && !inlineRow
                ? <EmptyRow cols={sipVisibleCols.size + 1 + (isAdmin ? 1 : 0)} message="No SIP entries yet." />
                : pagedEntries.map(entry => (
                  <tr key={entry.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${entry.sip_type === 'withdraw' ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                    <Td className="text-sm text-gray-600 dark:text-gray-300">{fmt.date(entry.start_date) || '—'}</Td>
                    {sipVisibleCols.has('type') && <Td className="text-sm">
                      <span className={entry.sip_type === 'withdraw' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                        {entry.sip_type || '—'}
                      </span>
                    </Td>}
                    {sipVisibleCols.has('stock') && <Td>
                      {entry.stock_symbol
                        ? <><p className="font-semibold text-brand-600 dark:text-brand-400">{entry.stock_symbol}</p>
                            <p className="text-xs text-gray-400">{entry.stock_name}</p></>
                        : <span className="text-gray-400 text-sm">—</span>
                      }
                    </Td>}
                    {sipVisibleCols.has('amount') && <Td className={`font-semibold ${entry.sip_type === 'withdraw' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {entry.sip_type === 'withdraw' ? '−' : ''}{fmt.currency(entry.amount)}
                    </Td>}
                    {sipVisibleCols.has('notes') && <Td className="text-sm text-gray-500 dark:text-gray-400">{entry.notes || '—'}</Td>}
                    <Td>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(entry)} title="Edit"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openCopy(entry)} title="Copy row"
                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">
                            <Copy size={14} />
                          </button>
                          <button onClick={() => setDeleteId(entry.id)} title="Delete"
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))
              }
            </tbody>
          </Table>
          {totalPages > 1 && (
            <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              {(() => {
                const range = [];
                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
                }
                const withEllipsis = [];
                let prev = null;
                for (const p of range) {
                  if (prev !== null && p - prev > 1) withEllipsis.push('...' + p);
                  withEllipsis.push(p);
                  prev = p;
                }
                return (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft size={14} />
                    </button>
                    {withEllipsis.map((p, i) =>
                      typeof p === 'string'
                        ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                        : <button key={p} onClick={() => setPage(p)}
                            className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            {p}
                          </button>
                    )}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Add Entry Modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm({ stock_id: '', amount: '', date: '', sip_type: 'sip', notes: '' }); }} title="Add SIP Entry">
        <form onSubmit={handleCreate} className="space-y-4">
          {shareholderInfo && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Shareholder: <span className="font-semibold text-gray-900 dark:text-white">{shareholderInfo.name}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input type="date" lang="en-US" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
              <input type="number" min="1" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required className="input w-full" placeholder="5000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={form.sip_type} onChange={e => setForm(f => ({ ...f, sip_type: e.target.value }))}
                required className="input w-full">
                {sipTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Stock (optional)</label>
              <select value={form.stock_id} onChange={e => setForm(f => ({ ...f, stock_id: e.target.value }))}
                className="input w-full">
                <option value="">— None —</option>
                {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input w-full" rows={2} placeholder="e.g. Jan 2025 SIP" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setCreateOpen(false); setForm({ stock_id: '', amount: '', date: '', sip_type: 'sip', notes: '' }); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add Entry'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editEntry} onClose={() => setEditEntry(null)} title="Edit SIP Entry">
        {editEntry && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input type="date" lang="en-US" value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
                <input type="number" min="1" step="0.01" value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  required className="input w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select value={editForm.sip_type} onChange={e => setEditForm(f => ({ ...f, sip_type: e.target.value }))}
                  required className="input w-full">
                  {sipTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Stock (optional)</label>
                <select value={editForm.stock_id} onChange={e => setEditForm(f => ({ ...f, stock_id: e.target.value }))}
                  className="input w-full">
                  <option value="">— None —</option>
                  {editStocks.map(s => <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                className="input w-full" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditEntry(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={editSaving} className="btn-primary">{editSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Entry" size="sm">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Delete this SIP entry? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
