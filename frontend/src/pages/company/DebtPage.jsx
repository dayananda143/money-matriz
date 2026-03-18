import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Landmark, CreditCard, Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const EMPTY = { description: '', amount: '', record_date: today(), notes: '', user_id: '' };
const EMPTY_PAYMENT = { amount: '', payment_date: today(), notes: '' };

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={13} className="text-gray-400 ml-1 inline" />;
  return sort.dir === 'asc'
    ? <ChevronUp size={13} className="text-brand-600 ml-1 inline" />
    : <ChevronDown size={13} className="text-brand-600 ml-1 inline" />;
}

export default function DebtPage() {
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filter & sort
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [sort, setSort] = useState({ col: 'record_date', dir: 'desc' });

  // Payments state
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [paymentModal, setPaymentModal] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/company?category=debt'), api.get('/users')])
      .then(([r, u]) => { setRecords(r.data); setUsers(u.data.filter(x => x.is_active)); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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
    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sort.col === 'amount') { av = parseFloat(a.amount); bv = parseFloat(b.amount); }
      else if (sort.col === 'paid') { av = parseFloat(a.total_paid || 0); bv = parseFloat(b.total_paid || 0); }
      else if (sort.col === 'remaining') { av = parseFloat(a.amount) - parseFloat(a.total_paid || 0); bv = parseFloat(b.amount) - parseFloat(b.total_paid || 0); }
      else if (sort.col === 'record_date') { av = a.record_date; bv = b.record_date; }
      else if (sort.col === 'description') { av = a.description?.toLowerCase(); bv = b.description?.toLowerCase(); }
      else if (sort.col === 'user_name') { av = a.user_name?.toLowerCase() || ''; bv = b.user_name?.toLowerCase() || ''; }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [records, search, dateFrom, dateTo, filterUser, sort]);

  const usersInRecords = useMemo(() => {
    const seen = new Map();
    records.forEach(r => { if (r.user_id && r.user_name && !seen.has(r.user_id)) seen.set(r.user_id, r.user_name); });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  const hasFilters = search || dateFrom || dateTo || filterUser;
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterUser(''); };

  const openCreate = () => { setForm({ ...EMPTY, record_date: today() }); setError(''); setModal('create'); };
  const openEdit = (r) => {
    setSelected(r);
    setForm({ description: r.description, amount: r.amount, record_date: r.record_date?.slice(0, 10) || today(), notes: r.notes || '', user_id: r.user_id || '' });
    setError(''); setModal('edit');
  };
  const openDelete = (r) => { setSelected(r); setModal('delete'); };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...form, category: 'debt', amount: parseFloat(form.amount), user_id: form.user_id || null };
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

  // Payments
  const openPayments = async (r) => {
    setSelected(r);
    setPaymentForm(EMPTY_PAYMENT);
    setPaymentError('');
    setPaymentModal(null);
    setModal('payments');
    setPaymentsLoading(true);
    try {
      const res = await api.get(`/company/${r.id}/payments`);
      setPayments(res.data);
    } catch (err) { console.error(err); }
    finally { setPaymentsLoading(false); }
  };

  const addPayment = async (e) => {
    e.preventDefault(); setPaymentError(''); setPaymentSaving(true);
    try {
      await api.post(`/company/${selected.id}/payments`, { ...paymentForm, amount: parseFloat(paymentForm.amount) });
      setPaymentModal(null);
      setPaymentForm(EMPTY_PAYMENT);
      const [res, list] = await Promise.all([api.get('/company?category=debt'), api.get(`/company/${selected.id}/payments`)]);
      setRecords(res.data);
      setPayments(list.data);
      setSelected(res.data.find(r => r.id === selected.id) || selected);
    } catch (err) { setPaymentError(err.message); } finally { setPaymentSaving(false); }
  };

  const confirmDeletePayment = async () => {
    setPaymentSaving(true);
    try {
      await api.delete(`/company/${selected.id}/payments/${selectedPayment.id}`);
      setPaymentModal(null);
      const [res, list] = await Promise.all([api.get('/company?category=debt'), api.get(`/company/${selected.id}/payments`)]);
      setRecords(res.data);
      setPayments(list.data);
      setSelected(res.data.find(r => r.id === selected.id) || selected);
    } catch (err) { alert(err.message); } finally { setPaymentSaving(false); }
  };

  const total = records.reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalPaid = records.reduce((s, r) => s + parseFloat(r.total_paid || 0), 0);
  const totalRemaining = total - totalPaid;
  const filteredTotal = filtered.reduce((s, r) => s + parseFloat(r.amount), 0);
  const filteredPaid = filtered.reduce((s, r) => s + parseFloat(r.total_paid || 0), 0);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} cols="grid-cols-1 sm:grid-cols-3" />
      <SkeletonTable rows={6} cols={8} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/company" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-900/20">
              <Landmark size={18} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Debt</h1>
              <p className="text-gray-500 text-sm">Company loans, liabilities and repayment schedules</p>
            </div>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Debt
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Debt</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {hasFilters ? <>{fmt.currency(filteredTotal)} <span className="text-sm font-normal text-gray-400">of {fmt.currency(total)}</span></> : fmt.currency(total)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Paid</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {hasFilters ? <>{fmt.currency(filteredPaid)} <span className="text-sm font-normal text-gray-400">of {fmt.currency(totalPaid)}</span></> : fmt.currency(totalPaid)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Remaining</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {hasFilters ? <>{fmt.currency(filteredTotal - filteredPaid)} <span className="text-sm font-normal text-gray-400">of {fmt.currency(totalRemaining)}</span></> : fmt.currency(totalRemaining)}
          </p>
        </div>
      </div>

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
          <select className="input py-2 text-sm min-w-[160px]" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">All users</option>
            {usersInRecords.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
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
              <Th onClick={() => toggleSort('user_name')} className="cursor-pointer select-none whitespace-nowrap">
                User <SortIcon col="user_name" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('amount')} className="cursor-pointer select-none whitespace-nowrap">
                Amount <SortIcon col="amount" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('paid')} className="cursor-pointer select-none whitespace-nowrap">
                Paid <SortIcon col="paid" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('remaining')} className="cursor-pointer select-none whitespace-nowrap">
                Remaining <SortIcon col="remaining" sort={sort} />
              </Th>
              <Th>Notes</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={8} message={hasFilters ? 'No records match your filters' : 'No debt records yet'} />}
            {filtered.map(r => {
              const paid = parseFloat(r.total_paid || 0);
              const remaining = parseFloat(r.amount) - paid;
              return (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td className="text-gray-500 text-sm">{fmt.date(r.record_date)}</Td>
                  <Td className="font-medium text-gray-900 dark:text-white">{r.description}</Td>
                  <Td>
                    {r.user_name
                      ? <div><p className="font-medium text-gray-900 dark:text-white text-sm">{r.user_name}</p><p className="text-xs text-gray-400">{r.user_type}</p></div>
                      : <span className="text-gray-400 text-xs">—</span>
                    }
                  </Td>
                  <Td className="font-semibold">{fmt.currency(r.amount)}</Td>
                  <Td className="text-green-600 dark:text-green-400 font-medium">{fmt.currency(paid)}</Td>
                  <Td>
                    <span className={remaining <= 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                      {remaining <= 0 ? 'Paid off' : fmt.currency(remaining)}
                    </span>
                  </Td>
                  <Td className="text-gray-500 text-xs">{r.notes || '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openPayments(r)} className="p-1 text-gray-400 hover:text-blue-600" title="Payments"><CreditCard size={14} /></button>
                      <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit"><Edit2 size={14} /></button>
                      <button onClick={() => openDelete(r)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      {/* Create / Edit modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add Debt Record' : 'Edit Debt Record'}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">User (optional)</label>
            <select className="input" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
              <option value="">Select user...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.user_type})</option>
              ))}
            </select>
          </div>
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

      {/* Delete debt modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete Debt Record">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Delete <strong>{selected?.description}</strong>? All payment records will also be deleted. This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} disabled={saving} className="btn-danger flex-1">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>

      {/* Payments modal */}
      <Modal open={modal === 'payments'} onClose={() => setModal(null)} size="lg"
        title={selected ? `Payments — ${selected.description}` : 'Payments'}
        headerAction={
          <button onClick={() => { setPaymentForm(EMPTY_PAYMENT); setPaymentError(''); setPaymentModal('add'); }}
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <Plus size={15} /> Add Payment
          </button>
        }>
        <div className="space-y-4">
          {selected && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Debt</p>
                <p className="font-bold text-gray-900 dark:text-white">{fmt.currency(selected.amount)}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Paid</p>
                <p className="font-bold text-green-600 dark:text-green-400">{fmt.currency(selected.total_paid || 0)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="font-bold text-red-600 dark:text-red-400">{fmt.currency(parseFloat(selected.amount) - parseFloat(selected.total_paid || 0))}</p>
              </div>
            </div>
          )}
          {paymentsLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Amount</Th>
                  <Th>Notes</Th>
                  <Th>Added By</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {!payments.length && <EmptyRow cols={5} message="No payments recorded yet" />}
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <Td className="text-gray-500 text-sm">{fmt.date(p.payment_date)}</Td>
                    <Td className="font-semibold text-green-600 dark:text-green-400">{fmt.currency(p.amount)}</Td>
                    <Td className="text-gray-500 text-xs">{p.notes || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{p.created_by_name || '—'}</Td>
                    <Td>
                      <button onClick={() => { setSelectedPayment(p); setPaymentModal('delete'); }}
                        className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Modal>

      {/* Add payment modal */}
      <Modal open={paymentModal === 'add'} onClose={() => setPaymentModal(null)} title="Add Payment">
        <form onSubmit={addPayment} className="space-y-4">
          {paymentError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{paymentError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" className="input" min="0" step="0.01" value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Payment Date</label>
              <input type="date" className="input" value={paymentForm.payment_date}
                onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} value={paymentForm.notes}
              onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. EMI payment, partial repayment..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPaymentModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={paymentSaving} className="btn-primary flex-1">{paymentSaving ? 'Saving...' : 'Add Payment'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete payment modal */}
      <Modal open={paymentModal === 'delete'} onClose={() => setPaymentModal(null)} title="Delete Payment">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Delete payment of <strong>{selectedPayment && fmt.currency(selectedPayment.amount)}</strong>? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setPaymentModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDeletePayment} disabled={paymentSaving} className="btn-danger flex-1">{paymentSaving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
