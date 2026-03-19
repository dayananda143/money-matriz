import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Copy, PieChart as PieIcon, Users, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, X, EyeOff, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
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

  // View tabs
  const [view, setView] = useState('entries');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userRecords, setUserRecords] = useState([]);
  const [userRecordsLoading, setUserRecordsLoading] = useState(false);

  // Filter & sort & pagination
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sort, setSort] = useState({ col: 'record_date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [activeSlice, setActiveSlice] = useState(null);

  // Contributors state
  const [contributors, setContributors] = useState([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [contributorForm, setContributorForm] = useState(EMPTY_CONTRIBUTOR);
  const [contributorModal, setContributorModal] = useState(null);
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [contributorSaving, setContributorSaving] = useState(false);
  const [contributorError, setContributorError] = useState('');
  const [bulkAmounts, setBulkAmounts] = useState({});

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/company?category=shares'),
      api.get('/users'),
      api.get('/company/shares-summary'),
      api.get('/config'),
    ]).then(([r, u, s, cfg]) => {
      setRecords(r.data);
      setShareholders(u.data.filter(x => x.user_type === 'shareholder').sort((a, b) => a.name.localeCompare(b.name)));
      setSummary(s.data);
      setShareTypes(cfg.data.share_types || []);
    }).catch(console.error).finally(() => setLoading(false));
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
  }, [records, search, dateFrom, dateTo, filterType, sort]);

  const hasFilters = search || dateFrom || dateTo || filterType;
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterType(''); setPage(1); };

  const loadUserRecords = async (userId) => {
    if (!userId) { setUserRecords([]); return; }
    setUserRecordsLoading(true);
    try {
      const res = await api.get(`/company/contributors/by-user/${userId}?category=shares`);
      setUserRecords(res.data);
    } catch (err) { console.error(err); }
    finally { setUserRecordsLoading(false); }
  };

  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    loadUserRecords(userId);
  };

  const totalPages = Math.ceil(filtered.length / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

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
      if (modal === 'create') {
        const { data: newRecord } = await api.post('/company', payload);
        load();
        setSelected(newRecord);
        setContributors([]);
        setContributorForm(EMPTY_CONTRIBUTOR);
        setContributorError('');
        setContributorModal(null);
        setModal('contributors');
      } else {
        await api.put(`/company/${selected.id}`, payload);
        setModal(null); load();
      }
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

  const editContributor = async (e) => {
    e.preventDefault(); setContributorError(''); setContributorSaving(true);
    try {
      await api.put(`/company/${selected.id}/contributors/${selectedContributor.id}`, {
        amount: parseFloat(contributorForm.amount),
        notes: contributorForm.notes || '',
      });
      setContributorModal(null);
      await refreshContributors();
    } catch (err) { setContributorError(err.message); } finally { setContributorSaving(false); }
  };

  const toggleExcludeContributor = async (c) => {
    try {
      await api.patch(`/company/${selected.id}/contributors/${c.id}/excluded`);
      await refreshContributors();
    } catch (err) { alert(err.message); }
  };

  const confirmDeleteContributor = async () => {
    setContributorSaving(true);
    try {
      await api.delete(`/company/${selected.id}/contributors/${selectedContributor.id}`);
      setContributorModal(null);
      await refreshContributors();
    } catch (err) { alert(err.message); } finally { setContributorSaving(false); }
  };

  const [copyForm, setCopyForm] = useState({ description: '', record_date: today() });
  const [copyError, setCopyError] = useState('');
  const [copySaving, setCopySaving] = useState(false);

  const openCopy = (r) => {
    setSelected(r);
    setCopyForm({ description: '', record_date: today() });
    setCopyError('');
    setModal('copy');
  };

  const submitCopy = async (e) => {
    e.preventDefault();
    setCopyError('');
    setCopySaving(true);
    try {
      // Create new entry
      const { data: newRecord } = await api.post('/company', {
        category: 'shares',
        amount: 0,
        description: copyForm.description,
        record_date: copyForm.record_date,
        notes: selected.notes || '',
        share_type: selected.share_type || null,
      });
      // Fetch original contributors and copy them
      const { data: origContribs } = await api.get(`/company/${selected.id}/contributors`);
      if (origContribs.length) {
        await Promise.all(origContribs.map(c =>
          api.post(`/company/${newRecord.id}/contributors`, {
            user_id: c.user_id,
            amount: parseFloat(c.amount),
            notes: c.notes || '',
          })
        ));
      }
      setModal(null);
      load();
    } catch (err) { setCopyError(err.message); } finally { setCopySaving(false); }
  };

  const openBulkAdd = () => {
    const init = {};
    availableShareholders.forEach(s => { init[s.id] = ''; });
    setBulkAmounts(init);
    setContributorError('');
    setContributorModal('bulk');
  };

  const submitBulkAdd = async (e) => {
    e.preventDefault();
    setContributorError('');
    const entries = Object.entries(bulkAmounts).filter(([, v]) => v !== '' && parseFloat(v) > 0);
    if (!entries.length) { setContributorError('Enter an amount for at least one shareholder.'); return; }
    setContributorSaving(true);
    try {
      await Promise.all(entries.map(([userId, amount]) =>
        api.post(`/company/${selected.id}/contributors`, { user_id: userId, amount: parseFloat(amount), notes: '' })
      ));
      setContributorModal(null);
      await refreshContributors();
    } catch (err) { setContributorError(err.message); } finally { setContributorSaving(false); }
  };

  const totalContributed = records.reduce((s, r) => s + parseFloat(r.total_contributed || 0), 0);
  const totalEntries = records.length;

  const filteredTotal = filtered.reduce((s, r) => s + parseFloat(r.total_contributed || 0), 0);

  const byType = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const t = r.share_type || '__none__';
      if (!map[t]) map[t] = { total: 0, count: 0 };
      map[t].total += parseFloat(r.total_contributed || 0);
      map[t].count += 1;
    });
    return Object.entries(map)
      .map(([type, { total, count }]) => ({ type, total, count }))
      .sort((a, b) => b.total - a.total);
  }, [records]);

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

      {/* By Type cards */}
      {byType.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">By Type</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {byType.map(({ type, total, count }) => (
              <div key={type} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  {type === '__none__'
                    ? <span className="text-xs text-gray-400 font-medium">No Type</span>
                    : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">{type.replace(/_/g, ' ')}</span>}
                  <span className="text-xs text-gray-400">{count} entr{count !== 1 ? 'ies' : 'y'}</span>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt.currency(total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ownership Chart */}
      {summary.length > 0 && (() => {
        const grandTotal = summary.reduce((s, r) => s + parseFloat(r.total_amount), 0);
        const chartData = summary.map(r => ({
          name: r.name,
          value: parseFloat(r.total_amount),
          pct: grandTotal > 0 ? ((parseFloat(r.total_amount) / grandTotal) * 100).toFixed(1) : '0.0',
        }));
        return (
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Ownership Breakdown</h2>
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative w-full lg:w-48 h-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={44} outerRadius={76}
                      dataKey="value" nameKey="name" paddingAngle={2}
                      onMouseEnter={(_, index) => setActiveSlice(index)}
                      onMouseLeave={() => setActiveSlice(null)}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]}
                          opacity={activeSlice === null || activeSlice === i ? 1 : 0.45} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {activeSlice !== null ? (
                    <div className="text-center px-1" style={{ maxWidth: 80 }}>
                      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 leading-tight break-words">{chartData[activeSlice].name}</p>
                      <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-0.5">{fmt.currency(chartData[activeSlice].value)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{chartData[activeSlice].pct}%</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">Total</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{fmt.currency(grandTotal)}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mb-2">
                  {chartData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 py-1.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-800 dark:text-gray-200 font-medium truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-semibold text-violet-600 dark:text-violet-400">{fmt.currency(d.value)}</span>
                        <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold px-1.5 py-0.5 rounded-full">{d.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 text-xs border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white">{fmt.currency(grandTotal)}</span>
                    <span className="font-bold text-gray-500">100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setView('entries')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'entries' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          All Entries
        </button>
        <button onClick={() => setView('by_user')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'by_user' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          By Shareholder
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
                <SkeletonTable rows={4} cols={5} />
              ) : (
                <>
                  {userRecords.length > 0 && (
                    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-500">{userRecords.length} entr{userRecords.length !== 1 ? 'ies' : 'y'}</span>
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                        Total: {fmt.currency(userRecords.filter(r => !r.excluded).reduce((s, r) => s + parseFloat(r.amount), 0))}
                      </span>
                    </div>
                  )}
                  <Table>
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Description</Th>
                        <Th>Type</Th>
                        <Th>Amount</Th>
                        <Th>Notes</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {!userRecords.length && <EmptyRow cols={5} message="No share entries found for this shareholder" />}
                      {userRecords.map(r => (
                        <tr key={r.contributor_id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${r.excluded ? 'opacity-50' : ''}`}>
                          <Td className="text-gray-500 text-sm">{fmt.date(r.record_date)}</Td>
                          <Td className="font-medium text-gray-900 dark:text-white">{r.description}</Td>
                          <Td>
                            {r.share_type
                              ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">{r.share_type.replace(/_/g, ' ')}</span>
                              : <span className="text-gray-400 text-xs">—</span>}
                          </Td>
                          <Td>
                            <span className={`font-semibold ${r.excluded ? 'line-through text-gray-400' : 'text-violet-600 dark:text-violet-400'}`}>{fmt.currency(r.amount)}</span>
                            {r.excluded && <span className="ml-2 text-xs text-orange-500 font-medium">excluded</span>}
                          </Td>
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
      ) : (<>

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
            <select className="input py-2 text-sm min-w-[160px]" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
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
        <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Share Entries</h2>
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
            <Plus size={15} /> Add Entry
          </button>
        </div>
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
            {paginated.map(r => (
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
                    <button onClick={() => openCopy(r)} className="p-1 text-gray-400 hover:text-emerald-600" title="Copy"><Copy size={14} /></button>
                    <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => openDelete(r)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </Td>
              </tr>
            ))}
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

      </>)}

      {/* Copy modal */}
      <Modal open={modal === 'copy'} onClose={() => setModal(null)} title={`Copy — ${selected?.description}`}>
        <form onSubmit={submitCopy} className="space-y-4">
          {copyError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{copyError}</div>}
          <p className="text-sm text-gray-500 dark:text-gray-400">All shareholder amounts will be copied. Just set the new description and date.</p>
          <div>
            <label className="label">New Description</label>
            <input className="input" value={copyForm.description} autoFocus required
              onChange={e => setCopyForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Q2 2025 allocation" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={copyForm.record_date} required
              onChange={e => setCopyForm(f => ({ ...f, record_date: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={copySaving} className="btn-primary flex-1">{copySaving ? 'Copying...' : 'Copy Entry'}</button>
          </div>
        </form>
      </Modal>

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
            <label className="label">Type</label>
            {shareTypes.length > 0 ? (
              <select className="input" value={form.share_type} onChange={e => setForm(f => ({ ...f, share_type: e.target.value }))} required>
                <option value="">Select type...</option>
                {shareTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            ) : (
              <input className="input" value={form.share_type}
                onChange={e => setForm(f => ({ ...f, share_type: e.target.value }))}
                placeholder="No types configured — add in Platform Settings" required />
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
            <div className="flex items-center gap-3">
              <button onClick={openBulkAdd}
                className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 font-medium">
                <Users size={15} /> Add All
              </button>
              <button onClick={() => { setContributorForm(EMPTY_CONTRIBUTOR); setContributorError(''); setContributorModal('add'); }}
                className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
                <Plus size={15} /> Add One
              </button>
            </div>
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
                    <Td className={c.excluded ? 'opacity-40' : ''}>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{c.user_name}</p>
                      <p className="text-xs text-gray-400">{c.user_email}</p>
                    </Td>
                    <Td className={c.excluded ? 'opacity-40' : ''}>
                      <span className={`font-semibold ${c.excluded ? 'line-through text-gray-400' : 'text-violet-600 dark:text-violet-400'}`}>{fmt.currency(c.amount)}</span>
                      {c.excluded && <span className="ml-2 text-xs text-orange-500 font-medium">excluded</span>}
                    </Td>
                    <Td className={`text-gray-500 text-xs${c.excluded ? ' opacity-40' : ''}`}>{c.notes || '—'}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleExcludeContributor(c)}
                          className={`p-1 ${c.excluded ? 'text-orange-500 hover:text-orange-600' : 'text-gray-400 hover:text-orange-500'}`}
                          title={c.excluded ? 'Include' : 'Exclude'}>
                          {c.excluded ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => { setSelectedContributor(c); setContributorForm({ user_id: c.user_id, amount: c.amount, notes: c.notes || '' }); setContributorError(''); setContributorModal('edit'); }}
                          className="p-1 text-gray-400 hover:text-brand-600"><Edit2 size={14} /></button>
                        <button onClick={() => { setSelectedContributor(c); setContributorModal('delete'); }}
                          className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
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

      {/* Edit contributor modal */}
      <Modal open={contributorModal === 'edit'} onClose={() => setContributorModal(null)} title={`Edit — ${selectedContributor?.user_name}`}>
        <form onSubmit={editContributor} className="space-y-4">
          {contributorError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{contributorError}</div>}
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input" min="0" step="0.01" value={contributorForm.amount}
              onChange={e => setContributorForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} value={contributorForm.notes}
              onChange={e => setContributorForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setContributorModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={contributorSaving} className="btn-primary flex-1">{contributorSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk add modal */}
      <Modal open={contributorModal === 'bulk'} onClose={() => setContributorModal(null)} title="Add All Shareholders">
        <form onSubmit={submitBulkAdd} className="space-y-4">
          {contributorError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{contributorError}</div>}
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter amounts for each shareholder. Leave blank to skip.</p>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {availableShareholders.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</span>
                <input
                  type="number" min="0" step="0.01" placeholder="Amount (₹)"
                  className="input w-40 py-1.5 text-sm"
                  value={bulkAmounts[s.id] ?? ''}
                  onChange={e => setBulkAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setContributorModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={contributorSaving} className="btn-primary flex-1">{contributorSaving ? 'Saving...' : 'Add All'}</button>
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
