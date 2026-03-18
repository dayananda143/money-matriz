import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const EMPTY = { description: '', amount: '', record_date: today(), notes: '', user_id: '', transaction_type: '', scheme: '' };

const TRANSACTION_TYPES = [
  { value: 'investment',      label: 'Investment',      badge: 'badge-blue' },
  { value: 'profit_return',   label: 'Profit Return',   badge: 'badge-green' },
  { value: 'loss_return',     label: 'Loss Return',     badge: 'badge-red' },
  { value: 'partial_return',  label: 'Partial Return',  badge: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
];
const txType = (v) => TRANSACTION_TYPES.find(t => t.value === v);

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={13} className="text-gray-400 ml-1 inline" />;
  return sort.dir === 'asc'
    ? <ChevronUp size={13} className="text-brand-600 ml-1 inline" />
    : <ChevronDown size={13} className="text-brand-600 ml-1 inline" />;
}

export default function CategoryPage({ category, label, description, icon: Icon, color, bg, withUser = false, userFilter = null, withTransactionType = false, withScheme = false }) {
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [allSchemes, setAllSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filter & sort state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterTxType, setFilterTxType] = useState('');
  const [sort, setSort] = useState({ col: 'record_date', dir: 'desc' });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/company?category=${category}`),
      withUser ? api.get('/users') : Promise.resolve(null),
      withScheme ? api.get('/config') : Promise.resolve(null),
    ])
      .then(([r, u, cfg]) => {
        setRecords(r.data);
        if (u) setUsers(u.data.filter(x => userFilter ? x.user_type === userFilter : x.is_active));
        if (cfg) setAllSchemes(cfg.data.schemes || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [category]);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };

  const filtered = useMemo(() => {
    let rows = records;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.description?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q) || r.user_name?.toLowerCase().includes(q));
    }
    if (dateFrom) rows = rows.filter(r => r.record_date >= dateFrom);
    if (dateTo) rows = rows.filter(r => r.record_date <= dateTo);
    if (filterUser) rows = rows.filter(r => String(r.user_id) === filterUser);
    if (filterTxType) rows = rows.filter(r => r.transaction_type === filterTxType);
    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sort.col === 'amount') { av = parseFloat(a.amount); bv = parseFloat(b.amount); }
      else if (sort.col === 'record_date') { av = a.record_date; bv = b.record_date; }
      else if (sort.col === 'description') { av = a.description?.toLowerCase(); bv = b.description?.toLowerCase(); }
      else if (sort.col === 'user_name') { av = a.user_name?.toLowerCase() || ''; bv = b.user_name?.toLowerCase() || ''; }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [records, search, dateFrom, dateTo, filterUser, filterTxType, sort]);

  const usersInRecords = useMemo(() => {
    const seen = new Map();
    records.forEach(r => { if (r.user_id && r.user_name && !seen.has(r.user_id)) seen.set(r.user_id, r.user_name); });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  const hasFilters = search || dateFrom || dateTo || filterUser || filterTxType;
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterUser(''); setFilterTxType(''); };

  const openCreate = () => { setForm({ ...EMPTY, record_date: today() }); setError(''); setModal('create'); };
  const openEdit = (r) => {
    setSelected(r);
    setForm({ description: r.description, amount: r.amount, record_date: r.record_date?.slice(0,10) || today(), notes: r.notes || '', user_id: r.user_id || '', transaction_type: r.transaction_type || '', scheme: r.scheme || '' });
    setError(''); setModal('edit');
  };
  const openDelete = (r) => { setSelected(r); setModal('delete'); };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...form, category, amount: parseFloat(form.amount), user_id: form.user_id || null, transaction_type: form.transaction_type || null, scheme: form.scheme || null };
      if (modal === 'create') await api.post('/company', payload);
      else await api.put(`/company/${selected.id}`, payload);
      setModal(null); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try { await api.delete(`/company/${selected.id}`); setModal(null); load(); }
    catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  const total = records.reduce((s, r) => s + parseFloat(r.amount), 0);
  const filteredTotal = filtered.reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalInvested = records.filter(r => r.transaction_type === 'investment').reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalReturned = records.filter(r => ['profit_return','loss_return','partial_return'].includes(r.transaction_type)).reduce((s, r) => s + parseFloat(r.amount), 0);
  const netPnl = totalReturned - totalInvested;
  const colCount = withUser ? (withTransactionType ? 8 : 7) : (withTransactionType ? 7 : 6);
  const schemeColCount = colCount + (withScheme ? 1 : 0);

  // For withScheme: get schemes available for the currently selected user
  const selectedUserSchemes = useMemo(() => {
    if (!withScheme || !form.user_id) return allSchemes;
    const u = users.find(u => String(u.id) === String(form.user_id));
    if (!u?.scheme) return allSchemes;
    const userSchemes = u.scheme.split(',').map(s => s.trim()).filter(Boolean);
    return userSchemes.length ? userSchemes : allSchemes;
  }, [withScheme, form.user_id, users, allSchemes]);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={2} cols="grid-cols-1 sm:grid-cols-2" />
      <SkeletonTable rows={6} cols={schemeColCount} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/company" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{label}</h1>
              <p className="text-gray-500 text-sm">{description}</p>
            </div>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Record
        </button>
      </div>

      {withTransactionType ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-5">
            <p className="text-sm text-gray-500">Total Records</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{records.length}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500">Total Invested</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{fmt.currency(totalInvested)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500">Total Returned</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalReturned)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500">Net P&amp;L</p>
            <p className={`text-2xl font-bold mt-1 ${netPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {netPnl >= 0 ? '+' : ''}{fmt.currency(netPnl)}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-sm text-gray-500">Total Records</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {hasFilters ? <>{filtered.length} <span className="text-sm font-normal text-gray-400">of {records.length}</span></> : records.length}
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {hasFilters ? <>{fmt.currency(filteredTotal)} <span className="text-sm font-normal text-gray-400">of {fmt.currency(total)}</span></> : fmt.currency(total)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 py-2 text-sm" placeholder="Search description, notes, user..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" className="input py-2 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" className="input py-2 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
          </div>
          {withUser && (
            <select className="input py-2 text-sm min-w-[160px]" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">All users</option>
              {usersInRecords.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {withTransactionType && (
            <select className="input py-2 text-sm min-w-[160px]" value={filterTxType} onChange={e => setFilterTxType(e.target.value)}>
              <option value="">All types</option>
              {TRANSACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <Table>
          <thead>
            <tr>
              <Th onClick={() => toggleSort('record_date')} className="cursor-pointer select-none whitespace-nowrap">
                Date <SortIcon col="record_date" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('description')} className="cursor-pointer select-none whitespace-nowrap">
                Description <SortIcon col="description" sort={sort} />
              </Th>
              {withUser && (
                <Th onClick={() => toggleSort('user_name')} className="cursor-pointer select-none whitespace-nowrap">
                  User <SortIcon col="user_name" sort={sort} />
                </Th>
              )}
              {withTransactionType && <Th>Type</Th>}
              {withScheme && <Th>Scheme</Th>}
              <Th onClick={() => toggleSort('amount')} className="cursor-pointer select-none whitespace-nowrap">
                Amount <SortIcon col="amount" sort={sort} />
              </Th>
              <Th>Notes</Th>
              <Th>Added By</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={schemeColCount} message={hasFilters ? 'No records match your filters' : `No ${label.toLowerCase()} records yet`} />}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td className="text-gray-500 text-sm">{fmt.date(r.record_date)}</Td>
                <Td className="font-medium text-gray-900 dark:text-white">{r.description}</Td>
                {withUser && (
                  <Td>
                    {r.user_name
                      ? <div><p className="font-medium text-gray-900 dark:text-white text-sm">{r.user_name}</p><p className="text-xs text-gray-400">{r.user_type}</p></div>
                      : <span className="text-gray-400 text-xs">—</span>
                    }
                  </Td>
                )}
                {withTransactionType && (
                  <Td>
                    {txType(r.transaction_type)
                      ? <span className={txType(r.transaction_type).badge}>{txType(r.transaction_type).label}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </Td>
                )}
                {withScheme && (
                  <Td>
                    {r.scheme
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{r.scheme.replace(/_/g, ' ')}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </Td>
                )}
                <Td className="font-semibold">{fmt.currency(r.amount)}</Td>
                <Td className="text-gray-500 text-xs">{r.notes || '—'}</Td>
                <Td className="text-gray-500 text-xs">{r.created_by_name || '—'}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-brand-600"><Edit2 size={14} /></button>
                    <button onClick={() => openDelete(r)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Create / Edit modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? `Add ${label} Record` : `Edit ${label} Record`}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          {withUser && (
            <div>
              <label className="label">User (optional)</label>
              <select className="input" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value, scheme: '' }))}>
                <option value="">Select user...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.user_type})</option>
                ))}
              </select>
            </div>
          )}
          {withScheme && (
            <div>
              <label className="label">Scheme (optional)</label>
              <select className="input" value={form.scheme} onChange={e => setForm(f => ({ ...f, scheme: e.target.value }))}>
                <option value="">— No scheme —</option>
                {selectedUserSchemes.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          )}
          {withTransactionType && (
            <div>
              <label className="label">Transaction Type</label>
              <select className="input" value={form.transaction_type} onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value }))} required>
                <option value="">Select type...</option>
                {TRANSACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="e.g. Bank loan repayment" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" className="input" min="0" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.record_date}
                onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete Record">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Delete <strong>{selected?.description}</strong>? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} disabled={saving} className="btn-danger flex-1">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
