import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Landmark, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, X, TrendingUp } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const EMPTY = { description: '', amount: '', bank_value: '', interest_rate: '', record_date: today(), maturity_date: '', share_type: 'FD', scheme: '', notes: '' };
const DEPOSIT_TYPES = ['FD', 'RD'];

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={13} className="text-gray-400 ml-1 inline" />;
  return sort.dir === 'asc'
    ? <ChevronUp size={13} className="text-brand-600 ml-1 inline" />
    : <ChevronDown size={13} className="text-brand-600 ml-1 inline" />;
}

function daysToMaturity(maturityDate) {
  if (!maturityDate) return null;
  const diff = Math.ceil((new Date(maturityDate) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function MaturityBadge({ date }) {
  if (!date) return <span className="text-gray-400 text-xs">—</span>;
  const days = daysToMaturity(date);
  if (days < 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500">Matured</span>;
  if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{days}d left</span>;
  if (days <= 90) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">{days}d left</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{days}d left</span>;
}

export default function DepositsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sort, setSort] = useState({ col: 'record_date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const load = () => {
    setLoading(true);
    api.get('/company?category=deposits')
      .then(r => setRecords(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    setPage(1);
  };

  const filtered = useMemo(() => {
    let rows = records;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.description?.toLowerCase().includes(q) || r.scheme?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q));
    }
    if (filterType) rows = rows.filter(r => r.share_type === filterType);
    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sort.col === 'amount') { av = parseFloat(a.amount || 0); bv = parseFloat(b.amount || 0); }
      else if (sort.col === 'bank_value') { av = parseFloat(a.bank_value || a.amount || 0); bv = parseFloat(b.bank_value || b.amount || 0); }
      else if (sort.col === 'interest') { av = parseFloat(a.bank_value || a.amount) - parseFloat(a.amount); bv = parseFloat(b.bank_value || b.amount) - parseFloat(b.amount); }
      else if (sort.col === 'record_date') { av = a.record_date; bv = b.record_date; }
      else if (sort.col === 'maturity_date') { av = a.maturity_date || '9999'; bv = b.maturity_date || '9999'; }
      else if (sort.col === 'description') { av = a.description?.toLowerCase(); bv = b.description?.toLowerCase(); }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [records, search, filterType, sort]);

  const hasFilters = search || filterType;
  const clearFilters = () => { setSearch(''); setFilterType(''); setPage(1); };

  const totalPages = Math.ceil(filtered.length / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  const totalPrincipal = records.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const totalBankValue = records.reduce((s, r) => s + parseFloat(r.bank_value || r.amount || 0), 0);
  const totalInterest = totalBankValue - totalPrincipal;

  const openCreate = () => { setForm({ ...EMPTY, record_date: today() }); setError(''); setModal('create'); };
  const openEdit = (r) => {
    setSelected(r);
    setForm({
      description: r.description,
      amount: r.amount,
      bank_value: r.bank_value || '',
      record_date: r.record_date?.slice(0, 10) || today(),
      maturity_date: r.maturity_date?.slice(0, 10) || '',
      share_type: r.share_type || 'FD',
      scheme: r.scheme || '',
      interest_rate: r.transaction_type || '',
      notes: r.notes || '',
    });
    setError(''); setModal('edit');
  };
  const openDelete = (r) => { setSelected(r); setModal('delete'); };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = {
        category: 'deposits',
        description: form.description,
        amount: parseFloat(form.amount),
        bank_value: form.bank_value !== '' ? parseFloat(form.bank_value) : null,
        record_date: form.record_date,
        maturity_date: form.maturity_date || null,
        share_type: form.share_type || null,
        scheme: form.scheme || null,
        transaction_type: form.interest_rate || null,
        notes: form.notes || null,
      };
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

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} cols="grid-cols-1 sm:grid-cols-3" />
      <SkeletonTable rows={6} cols={7} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/company" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-50 dark:bg-teal-900/20">
              <Landmark size={18} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Deposits</h1>
              <p className="text-gray-500 text-sm">Track FD & RD investments vs current bank value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Principal</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalPrincipal)}</p>
          <p className="text-xs text-gray-400 mt-1">{records.length} deposit{records.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Bank Value</p>
          <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">{fmt.currency(totalBankValue)}</p>
          <p className="text-xs text-gray-400 mt-1">Current balance per bank</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Interest Earned</p>
          <p className={`text-2xl font-bold mt-1 ${totalInterest >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {totalInterest >= 0 ? '+' : ''}{fmt.currency(totalInterest)}
          </p>
          {totalPrincipal > 0 && (
            <p className="text-xs text-gray-400 mt-1">{((totalInterest / totalPrincipal) * 100).toFixed(2)}% overall return</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 py-2 text-sm" placeholder="Search name or bank..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm min-w-[140px]" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            {DEPOSIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Deposits</h2>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
                {[5, 10, 15, 20, 25].map(n => (
                  <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                    className={`px-2.5 py-1 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3">
            <Plus size={15} /> Add Deposit
          </button>
        </div>
        <Table>
          <thead>
            <tr>
              <Th onClick={() => toggleSort('description')} className="cursor-pointer select-none whitespace-nowrap">
                Name <SortIcon col="description" sort={sort} />
              </Th>
              <Th>Type</Th>
              <Th>Bank</Th>
              <Th onClick={() => toggleSort('amount')} className="cursor-pointer select-none whitespace-nowrap">
                Principal <SortIcon col="amount" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('bank_value')} className="cursor-pointer select-none whitespace-nowrap">
                Bank Value <SortIcon col="bank_value" sort={sort} />
              </Th>
              <Th>Rate</Th>
              <Th onClick={() => toggleSort('interest')} className="cursor-pointer select-none whitespace-nowrap">
                Interest <SortIcon col="interest" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('record_date')} className="cursor-pointer select-none whitespace-nowrap">
                Start <SortIcon col="record_date" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('maturity_date')} className="cursor-pointer select-none whitespace-nowrap">
                Maturity <SortIcon col="maturity_date" sort={sort} />
              </Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={10} message={hasFilters ? 'No deposits match your filters' : 'No deposits added yet'} />}
            {paginated.map(r => {
              const principal = parseFloat(r.amount || 0);
              const bankVal = parseFloat(r.bank_value || r.amount || 0);
              const interest = bankVal - principal;
              const pct = principal > 0 ? ((interest / principal) * 100) : 0;
              return (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td className="font-medium text-gray-900 dark:text-white">{r.description}</Td>
                  <Td>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.share_type === 'RD' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'}`}>
                      {r.share_type || 'FD'}
                    </span>
                  </Td>
                  <Td className="text-gray-600 dark:text-gray-400 text-sm">{r.scheme || '—'}</Td>
                  <Td className="font-semibold text-gray-900 dark:text-white">{fmt.currency(principal)}</Td>
                  <Td className="font-semibold text-teal-600 dark:text-teal-400">
                    {r.bank_value != null ? fmt.currency(bankVal) : <span className="text-gray-400 text-xs">Not set</span>}
                  </Td>
                  <Td className="text-gray-600 dark:text-gray-400 text-sm">
                    {r.transaction_type ? <span className="font-medium">{r.transaction_type}%</span> : <span className="text-gray-400 text-xs">—</span>}
                  </Td>
                  <Td>
                    {r.bank_value != null ? (
                      <span className={`font-semibold ${interest >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {interest >= 0 ? '+' : ''}{fmt.currency(interest)}
                        <span className="text-xs font-normal text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                      </span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </Td>
                  <Td className="text-gray-500 text-sm">{fmt.date(r.record_date)}</Td>
                  <Td>
                    {r.maturity_date ? (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">{fmt.date(r.maturity_date)}</p>
                        <MaturityBadge date={r.maturity_date} />
                      </div>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit"><Edit2 size={14} /></button>
                      <button onClick={() => openDelete(r)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
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

      {/* Create / Edit modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add Deposit' : 'Edit Deposit'}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Name / Description</label>
            <input className="input" value={form.description} required autoFocus
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. SBI FD - March 2024" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.share_type} onChange={e => setForm(f => ({ ...f, share_type: e.target.value }))}>
                {DEPOSIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bank Name</label>
              <input className="input" value={form.scheme}
                onChange={e => setForm(f => ({ ...f, scheme: e.target.value }))}
                placeholder="e.g. SBI, HDFC" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Principal (₹)</label>
              <input type="number" className="input" min="0" step="0.01" value={form.amount} required
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Bank Value (₹)</label>
              <input type="number" className="input" min="0" step="0.01" value={form.bank_value}
                onChange={e => setForm(f => ({ ...f, bank_value: e.target.value }))}
                placeholder="Current value per bank" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.record_date} required
                onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Maturity Date</label>
              <input type="date" className="input" value={form.maturity_date}
                onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Interest Rate (%)</label>
              <input type="number" className="input" min="0" step="0.01" value={form.interest_rate}
                onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                placeholder="e.g. 7.5" />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. interest rate, account number..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete Deposit">
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
