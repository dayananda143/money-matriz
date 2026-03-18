import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, PieChart as PieIcon, Users, Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#14b8a6','#f97316','#8b5cf6','#84cc16','#06b6d4','#e11d48','#a3e635','#fb923c','#a855f7'];

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const EMPTY = { description: '', record_date: today(), notes: '', share_type: '' };
const EMPTY_CONTRIBUTOR = { user_id: '', amount: '', notes: '' };

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={13} className="text-gray-400 ml-1 inline" />;
  return sort.dir === 'asc'
    ? <ChevronUp size={13} className="text-brand-600 ml-1 inline" />
    : <ChevronDown size={13} className="text-brand-600 ml-1 inline" />;
}

export default function SharesPage() {
  const [records, setRecords] = useState([]);
  const [shareholders, setShareholders] = useState([]);
  const [summary, setSummary] = useState([]);
  const [shareTypes, setShareTypes] = useState([]);
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
  const [filterType, setFilterType] = useState('');
  const [sort, setSort] = useState({ col: 'record_date', dir: 'desc' });

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
      api.get('/company?category=shares'),
      api.get('/users'),
      api.get('/company/shares-summary'),
      api.get('/config'),
    ]).then(([r, u, s, cfg]) => {
      setRecords(r.data);
      setShareholders(u.data.filter(x => x.user_type === 'shareholder'));
      setSummary(s.data);
      setShareTypes(cfg.data.share_types || []);
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
    if (filterType) rows = rows.filter(r => r.share_type === filterType);
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

  const hasFilters = search || dateFrom || dateTo || filterType;
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterType(''); };

  const openCreate = () => { setForm({ ...EMPTY, record_date: today() }); setError(''); setModal('create'); };
  const openEdit = (r) => {
    setSelected(r);
    setForm({ description: r.description, record_date: r.record_date?.slice(0, 10) || today(), notes: r.notes || '', share_type: r.share_type || '' });
    setError(''); setModal('edit');
  };
  const openDelete = (r) => { setSelected(r); setModal('delete'); };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...form, category: 'shares', amount: 0, share_type: form.share_type || null };
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
    const [recs, contribs, s] = await Promise.all([
      api.get('/company?category=shares'),
      api.get(`/company/${selected.id}/contributors`),
      api.get('/company/shares-summary'),
    ]);
    setRecords(recs.data);
    setContributors(contribs.data);
    setSummary(s.data);
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

  const confirmDeleteContributor = async () => {
    setContributorSaving(true);
    try {
      await api.delete(`/company/${selected.id}/contributors/${selectedContributor.id}`);
      setContributorModal(null);
      await refreshContributors();
    } catch (err) { alert(err.message); } finally { setContributorSaving(false); }
  };

  const totalContributed = records.reduce((s, r) => s + parseFloat(r.total_contributed || 0), 0);
  const totalEntries = records.length;
  const totalShareholders = useMemo(() => {
    const seen = new Set();
    records.forEach(r => {
      // We don't have per-record shareholders in the list view, just count from records
    });
    return seen.size;
  }, [records]);

  const filteredTotal = filtered.reduce((s, r) => s + parseFloat(r.total_contributed || 0), 0);

  // Available shareholders not yet added to this entry
  const availableShareholders = useMemo(() => {
    const taken = new Set(contributors.map(c => c.user_id));
    return shareholders.filter(s => !taken.has(s.id));
  }, [shareholders, contributors]);

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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-50 dark:bg-violet-900/20">
              <PieIcon size={18} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shares</h1>
              <p className="text-gray-500 text-sm">Shareholder equity, allocations and ownership stakes</p>
            </div>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Entry
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Contributed</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
            {hasFilters
              ? <>{fmt.currency(filteredTotal)} <span className="text-sm font-normal text-gray-400">of {fmt.currency(totalContributed)}</span></>
              : fmt.currency(totalContributed)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Share Entries</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {hasFilters
              ? <>{filtered.length} <span className="text-sm font-normal text-gray-400">of {totalEntries}</span></>
              : totalEntries}
          </p>
        </div>
      </div>

      {/* Ownership Chart */}
      {summary.length > 0 && (() => {
        const grandTotal = summary.reduce((s, r) => s + parseFloat(r.total_amount), 0);
        const chartData = summary.map(r => ({
          name: r.name,
          value: parseFloat(r.total_amount),
          pct: grandTotal > 0 ? ((parseFloat(r.total_amount) / grandTotal) * 100).toFixed(1) : '0.0',
        }));
        return (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Ownership Breakdown</h2>
            <div className="flex flex-col lg:flex-row gap-6 items-center">
              <div className="w-full lg:w-64 h-64 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                      dataKey="value" nameKey="name" paddingAngle={2}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => fmt.currency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                      <th className="pb-2 font-medium">Shareholder</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((d, i) => (
                      <tr key={d.name} className="border-b border-gray-50 dark:border-gray-800">
                        <td className="py-2 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-900 dark:text-white font-medium">{d.name}</span>
                        </td>
                        <td className="py-2 text-right font-semibold text-violet-600 dark:text-violet-400">{fmt.currency(d.value)}</td>
                        <td className="py-2 text-right">
                          <span className="inline-block bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {d.pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="pt-3 font-semibold text-gray-700 dark:text-gray-300">Total</td>
                      <td className="pt-3 text-right font-bold text-gray-900 dark:text-white">{fmt.currency(grandTotal)}</td>
                      <td className="pt-3 text-right font-bold text-gray-500">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

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
          {shareTypes.length > 0 && (
            <select className="input py-2 text-sm min-w-[160px]" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All types</option>
              {shareTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
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
              <Th>Type</Th>
              <Th onClick={() => toggleSort('contributor_count')} className="cursor-pointer select-none whitespace-nowrap">
                Shareholders <SortIcon col="contributor_count" sort={sort} />
              </Th>
              <Th onClick={() => toggleSort('total_contributed')} className="cursor-pointer select-none whitespace-nowrap">
                Total Amount <SortIcon col="total_contributed" sort={sort} />
              </Th>
              <Th>Notes</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={7} message={hasFilters ? 'No entries match your filters' : 'No share entries yet'} />}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td className="text-gray-500 text-sm">{fmt.date(r.record_date)}</Td>
                <Td className="font-medium text-gray-900 dark:text-white">{r.description}</Td>
                <Td>
                  {r.share_type
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">{r.share_type.replace(/_/g, ' ')}</span>
                    : <span className="text-gray-400 text-xs">—</span>}
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                    <Users size={13} className="text-violet-500" />
                    {r.contributor_count}
                  </span>
                </Td>
                <Td className="font-semibold text-violet-600 dark:text-violet-400">{fmt.currency(r.total_contributed || 0)}</Td>
                <Td className="text-gray-500 text-xs">{r.notes || '—'}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openContributors(r)} className="p-1 text-gray-400 hover:text-violet-600" title="Shareholders"><Users size={14} /></button>
                    <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => openDelete(r)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Create / Edit modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add Share Entry' : 'Edit Share Entry'}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required
              placeholder="e.g. Founding round, Q1 2024 allocation" />
          </div>
          <div>
            <label className="label">Type (optional)</label>
            {shareTypes.length > 0 ? (
              <select className="input" value={form.share_type} onChange={e => setForm(f => ({ ...f, share_type: e.target.value }))}>
                <option value="">Select type...</option>
                {shareTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            ) : (
              <input className="input" value={form.share_type}
                onChange={e => setForm(f => ({ ...f, share_type: e.target.value }))}
                placeholder="No types configured — add in Platform Settings" />
            )}
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
              placeholder="Additional details about this share allocation..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete entry modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete Share Entry">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Delete <strong>{selected?.description}</strong>? All shareholder contributions for this entry will also be deleted. This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} disabled={saving} className="btn-danger flex-1">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>

      {/* Contributors modal */}
      <Modal open={modal === 'contributors'} onClose={() => setModal(null)} size="lg"
        title={selected ? `Shareholders — ${selected.description}` : 'Shareholders'}
        headerAction={
          availableShareholders.length > 0 ? (
            <button onClick={() => { setContributorForm(EMPTY_CONTRIBUTOR); setContributorError(''); setContributorModal('add'); }}
              className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
              <Plus size={15} /> Add Shareholder
            </button>
          ) : null
        }>
        <div className="space-y-4">
          {selected && (
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">Total contributed</span>
              <span className="text-lg font-bold text-violet-700 dark:text-violet-300">{fmt.currency(selected.total_contributed || 0)}</span>
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
                {!contributors.length && <EmptyRow cols={4} message="No shareholders added yet" />}
                {contributors.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <Td>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{c.user_name}</p>
                      <p className="text-xs text-gray-400">{c.user_email}</p>
                    </Td>
                    <Td className="font-semibold text-violet-600 dark:text-violet-400">{fmt.currency(c.amount)}</Td>
                    <Td className="text-gray-500 text-xs">{c.notes || '—'}</Td>
                    <Td>
                      <button onClick={() => { setSelectedContributor(c); setContributorModal('delete'); }}
                        className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Modal>

      {/* Add contributor modal */}
      <Modal open={contributorModal === 'add'} onClose={() => setContributorModal(null)} title="Add Shareholder">
        <form onSubmit={addContributor} className="space-y-4">
          {contributorError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{contributorError}</div>}
          <div>
            <label className="label">Shareholder</label>
            <select className="input" value={contributorForm.user_id}
              onChange={e => setContributorForm(f => ({ ...f, user_id: e.target.value }))} required>
              <option value="">Select shareholder...</option>
              {availableShareholders.map(s => (
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
              placeholder="e.g. 10% equity stake, preferred shares..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setContributorModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={contributorSaving} className="btn-primary flex-1">{contributorSaving ? 'Saving...' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete contributor modal */}
      <Modal open={contributorModal === 'delete'} onClose={() => setContributorModal(null)} title="Remove Shareholder">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Remove <strong>{selectedContributor?.user_name}</strong> ({fmt.currency(selectedContributor?.amount || 0)}) from this entry? This cannot be undone.
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
