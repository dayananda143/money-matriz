import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, TrendingUp, Users, Search, ChevronUp, ChevronDown, ChevronsUpDown, X, Pencil } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const EMPTY = { description: '', amount: '', record_date: today(), notes: '' };
const EMPTY_CONTRIBUTOR = { user_id: '', amount: '', notes: '' };
const VIEWS = ['transactions', 'by_user'];

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={13} className="text-gray-400 ml-1 inline" />;
  return sort.dir === 'asc'
    ? <ChevronUp size={13} className="text-brand-600 ml-1 inline" />
    : <ChevronDown size={13} className="text-brand-600 ml-1 inline" />;
}

export default function TradingInvestmentPage() {
  const [records, setRecords] = useState([]);
  const [shareholders, setShareholders] = useState([]);
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
  const [sort, setSort] = useState({ col: 'record_date', dir: 'desc' });

  // View toggle
  const [view, setView] = useState('transactions');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userRecords, setUserRecords] = useState([]);
  const [userRecordsLoading, setUserRecordsLoading] = useState(false);

  // Contributors state
  const [contributors, setContributors] = useState([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [contributorForm, setContributorForm] = useState(EMPTY_CONTRIBUTOR);
  const [contributorModal, setContributorModal] = useState(null);
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [contributorSaving, setContributorSaving] = useState(false);
  const [contributorError, setContributorError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/company?category=trading_investment'),
      api.get('/users'),
    ]).then(([r, u]) => {
      setRecords(r.data);
      setShareholders(u.data.filter(x => x.user_type === 'shareholder'));
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };

  const filtered = useMemo(() => {
    let rows = records;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.description?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q));
    }
    if (dateFrom) rows = rows.filter(r => r.record_date >= dateFrom);
    if (dateTo) rows = rows.filter(r => r.record_date <= dateTo);
    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sort.col === 'total_contributed') { av = parseFloat(a.total_contributed || 0); bv = parseFloat(b.total_contributed || 0); }
      else if (sort.col === 'contributor_count') { av = parseInt(a.contributor_count || 0); bv = parseInt(b.contributor_count || 0); }
      else if (sort.col === 'record_date') { av = a.record_date; bv = b.record_date; }
      else if (sort.col === 'description') { av = a.description?.toLowerCase(); bv = b.description?.toLowerCase(); }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [records, search, dateFrom, dateTo, sort]);

  const hasFilters = search || dateFrom || dateTo;
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); };

  const loadUserRecords = async (userId) => {
    if (!userId) { setUserRecords([]); return; }
    setUserRecordsLoading(true);
    try {
      const res = await api.get(`/company/contributors/by-user/${userId}`);
      setUserRecords(res.data);
    } catch (err) { console.error(err); }
    finally { setUserRecordsLoading(false); }
  };

  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    loadUserRecords(userId);
  };

  const openCreate = () => { setForm({ ...EMPTY, record_date: today() }); setError(''); setModal('create'); };
  const openEdit = (r) => {
    setSelected(r);
    setForm({ description: r.description, amount: r.amount, record_date: r.record_date?.slice(0, 10) || today(), notes: r.notes || '' });
    setError(''); setModal('edit');
  };
  const openDelete = (r) => { setSelected(r); setModal('delete'); };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...form, category: 'trading_investment', amount: parseFloat(form.amount) || 0 };
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

  // Contributors
  const openContributors = async (r) => {
    setSelected(r);
    setContributorForm(EMPTY_CONTRIBUTOR);
    setContributorError('');
    setContributorModal(null);
    setModal('contributors');
    setContributorsLoading(true);
    try {
      const res = await api.get(`/company/${r.id}/contributors`);
      setContributors(res.data);
    } catch (err) { console.error(err); }
    finally { setContributorsLoading(false); }
  };

  const refreshContributors = async () => {
    const [recs, contribs] = await Promise.all([
      api.get('/company?category=trading_investment'),
      api.get(`/company/${selected.id}/contributors`),
    ]);
    setRecords(recs.data);
    setContributors(contribs.data);
    setSelected(recs.data.find(r => r.id === selected.id) || selected);
  };

  const addContributor = async (e) => {
    e.preventDefault(); setContributorError(''); setContributorSaving(true);
    try {
      await api.post(`/company/${selected.id}/contributors`, {
        ...contributorForm,
        amount: parseFloat(contributorForm.amount),
      });
      setContributorModal(null);
      setContributorForm(EMPTY_CONTRIBUTOR);
      await refreshContributors();
    } catch (err) { setContributorError(err.message); } finally { setContributorSaving(false); }
  };

  const openEditContributor = (c) => {
    setSelectedContributor(c);
    setContributorForm({ user_id: c.user_id, amount: c.amount, notes: c.notes || '' });
    setContributorError('');
    setContributorModal('edit');
  };

  const editContributor = async (e) => {
    e.preventDefault(); setContributorError(''); setContributorSaving(true);
    try {
      await api.put(`/company/${selected.id}/contributors/${selectedContributor.id}`, {
        amount: parseFloat(contributorForm.amount),
        notes: contributorForm.notes,
      });
      setContributorModal(null);
      await refreshContributors();
    } catch (err) { setContributorError(err.message); } finally { setContributorSaving(false); }
  };

  const confirmDeleteContributor = async () => {
    setContributorSaving(true);
    try {
      await api.delete(`/company/${selected.id}/contributors/${selectedContributor.id}`);
      setContributorModal(null);
      await refreshContributors();
    } catch (err) { alert(err.message); } finally { setContributorSaving(false); }
  };

  const totalContributed = records.reduce((s, r) => s + parseFloat(r.total_contributed || 0), 0);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} cols="grid-cols-1 sm:grid-cols-3" />
      <SkeletonTable rows={6} cols={6} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/company" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
              <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trading Investment</h1>
              <p className="text-gray-500 text-sm">Short-term trading positions with per-user investment breakdown</p>
            </div>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Transactions</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {hasFilters
              ? <>{filtered.length} <span className="text-sm font-normal text-gray-400">of {records.length}</span></>
              : records.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Invested</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{fmt.currency(totalContributed)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Shareholders</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{shareholders.length}</p>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setView('transactions')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'transactions' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          All Transactions
        </button>
        <button onClick={() => setView('by_user')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'by_user' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          By User
        </button>
      </div>

      {view === 'by_user' ? (
        <div className="space-y-4">
          <div className="card p-4">
            <label className="label">Select Shareholder</label>
            <select className="input" value={selectedUserId} onChange={e => handleUserSelect(e.target.value)}>
              <option value="">Choose a shareholder...</option>
              {shareholders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {selectedUserId && (
            <div className="card">
              {userRecordsLoading ? (
                <SkeletonTable rows={4} cols={4} />
              ) : (
                <>
                  {userRecords.length > 0 && (
                    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-500">{userRecords.length} transaction{userRecords.length !== 1 ? 's' : ''}</span>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        Total: {fmt.currency(userRecords.reduce((s, r) => s + parseFloat(r.amount), 0))}
                      </span>
                    </div>
                  )}
                  <Table>
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Description</Th>
                        <Th>Amount</Th>
                        <Th>Notes</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {!userRecords.length && <EmptyRow cols={4} message="No transactions found for this shareholder" />}
                      {userRecords.map(r => (
                        <tr key={r.contributor_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <Td className="text-gray-500 text-sm">{fmt.date(r.record_date)}</Td>
                          <Td className="font-medium text-gray-900 dark:text-white">{r.description}</Td>
                          <Td className="font-semibold text-blue-600 dark:text-blue-400">{fmt.currency(r.amount)}</Td>
                          <Td className="text-gray-500 text-xs">{r.notes || r.record_notes || '—'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
      <>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 py-2 text-sm" placeholder="Search description or notes..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" className="input py-2 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" className="input py-2 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
          </div>
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
              <Th onClick={() => toggleSort('contributor_count')} className="cursor-pointer select-none whitespace-nowrap">
                Users <SortIcon col="contributor_count" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('total_contributed')} className="cursor-pointer select-none whitespace-nowrap">
                Total Invested <SortIcon col="total_contributed" sort={sort} />
              </Th>
              <Th>Notes</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={6} message={hasFilters ? 'No records match your filters' : 'No trading investment records yet'} />}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td className="text-gray-500 text-sm">{fmt.date(r.record_date)}</Td>
                <Td className="font-medium text-gray-900 dark:text-white">{r.description}</Td>
                <Td>
                  <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                    <Users size={13} className="text-blue-500" />
                    {r.contributor_count || 0}
                  </span>
                </Td>
                <Td className="font-semibold text-blue-600 dark:text-blue-400">{fmt.currency(r.total_contributed || 0)}</Td>
                <Td className="text-gray-500 text-xs">{r.notes || '—'}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openContributors(r)} className="p-1 text-gray-400 hover:text-blue-600" title="Manage Users"><Users size={14} /></button>
                    <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => openDelete(r)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      </>
      )}

      {/* Create / Edit modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add Trading Transaction' : 'Edit Trading Transaction'}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required
              placeholder="e.g. NIFTY Options Mar 2024" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.record_date}
              onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional details about this transaction..." />
          </div>
          <p className="text-xs text-gray-400">After saving, use the Users button to add shareholders and their individual invested amounts.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete entry modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete Transaction">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Delete <strong>{selected?.description}</strong>? All user contributions for this transaction will also be deleted. This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} disabled={saving} className="btn-danger flex-1">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>

      {/* Contributors modal */}
      <Modal open={modal === 'contributors'} onClose={() => setModal(null)} size="lg"
        title={selected ? `Users — ${selected.description}` : 'Users'}
        headerAction={
          <button onClick={() => { setContributorForm(EMPTY_CONTRIBUTOR); setContributorError(''); setContributorModal('add'); }}
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <Plus size={15} /> Add User
          </button>
        }>
        <div className="space-y-4">
          {selected && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total invested</span>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt.currency(selected.total_contributed || 0)}</span>
            </div>
          )}
          {contributorsLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Shareholder</Th>
                  <Th>Amount</Th>
                  <Th>Notes</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {!contributors.length && <EmptyRow cols={4} message="No users added yet" />}
                {contributors.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <Td>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{c.user_name}</p>
                      <p className="text-xs text-gray-400">{c.user_email}</p>
                    </Td>
                    <Td className="font-semibold text-blue-600 dark:text-blue-400">{fmt.currency(c.amount)}</Td>
                    <Td className="text-gray-500 text-xs">{c.notes || '—'}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditContributor(c)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => { setSelectedContributor(c); setContributorModal('delete'); }} className="p-1 text-gray-400 hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Modal>

      {/* Add contributor modal */}
      <Modal open={contributorModal === 'add'} onClose={() => setContributorModal(null)} title="Add User">
        <form onSubmit={addContributor} className="space-y-4">
          {contributorError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{contributorError}</div>}
          <div>
            <label className="label">Shareholder</label>
            <select className="input" value={contributorForm.user_id}
              onChange={e => setContributorForm(f => ({ ...f, user_id: e.target.value }))} required>
              <option value="">Select shareholder...</option>
              {shareholders.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input" min="0" step="0.01" value={contributorForm.amount}
              onChange={e => setContributorForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} value={contributorForm.notes}
              onChange={e => setContributorForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. 50% of total investment..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setContributorModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={contributorSaving} className="btn-primary flex-1">{contributorSaving ? 'Saving...' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit contributor modal */}
      <Modal open={contributorModal === 'edit'} onClose={() => setContributorModal(null)} title="Edit User">
        <form onSubmit={editContributor} className="space-y-4">
          {contributorError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{contributorError}</div>}
          <div>
            <label className="label">Shareholder</label>
            <input className="input bg-gray-50 dark:bg-gray-800" value={selectedContributor?.user_name || ''} disabled />
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input" min="0" step="0.01" value={contributorForm.amount}
              onChange={e => setContributorForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} value={contributorForm.notes}
              onChange={e => setContributorForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. 50% of total investment..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setContributorModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={contributorSaving} className="btn-primary flex-1">{contributorSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete contributor modal */}
      <Modal open={contributorModal === 'delete'} onClose={() => setContributorModal(null)} title="Remove User">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Remove <strong>{selectedContributor?.user_name}</strong> ({fmt.currency(selectedContributor?.amount || 0)}) from this transaction? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setContributorModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDeleteContributor} disabled={contributorSaving} className="btn-danger flex-1">{contributorSaving ? 'Removing...' : 'Remove'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
