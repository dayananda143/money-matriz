import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Key, UserCheck, UserX, Eye, EyeOff, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Layers, Columns } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonSearchBar, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY_FORM = { name: '', email: '', password: 'changeme', user_type: 'client', role: 'user', phone: '', scheme: '', proof_type: 'pan_card', proof: '', is_active: true, terminated_at: '' };
const PROOF_TYPES = [{ value: 'pan_card', label: 'PAN Card' }, { value: 'aadhar_card', label: 'Aadhar Card' }];

const TABS = [
  { key: 'employee',    label: 'Employee' },
  { key: 'shareholder', label: 'Shareholder' },
  { key: 'client',      label: 'Client' },
];

function tabFilter(u, tab) {
  if (tab === 'employee')    return u.user_type === 'employee';
  if (tab === 'shareholder') return u.user_type === 'shareholder';
  if (tab === 'client')      return u.user_type === 'client';
  return true;
}

function UserForm({ form, setForm, onSubmit, onCancel, isCreate, saving, error, userTypes, roles, schemes }) {
  const [showPw, setShowPw] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const handleSubmit = (e) => {
    if (form.user_type === 'client' && !form.scheme?.trim()) {
      e.preventDefault();
      alert('Please select at least one scheme for a client.');
      return;
    }
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Full Name</label>
          <input className="input" value={form.name} onChange={e => {
            const v = e.target.value;
            const name = v.charAt(0).toUpperCase() + v.slice(1);
            setForm(f => {
              const updates = { ...f, name };
              if (isCreate && !emailTouched) {
                updates.email = name.trim().toLowerCase().replace(/\s+/g, '.') + '@moneymatriz.com';
              }
              return updates;
            });
          }} required />
        </div>
        <div className="col-span-2">
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={e => { setEmailTouched(true); setForm(f => ({ ...f, email: e.target.value })); }} required autoComplete="off" />
        </div>
        {isCreate && (
          <div className="col-span-2">
            <label className="label">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input pr-10" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        )}
        <div>
          <label className="label">User Type</label>
          <select className="input" value={form.user_type} onChange={e => setForm(f => ({ ...f, user_type: e.target.value }))}>
            {userTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {roles.map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        {form.user_type === 'client' && (
          <div className="col-span-2">
            <label className="label">Scheme <span className="text-red-500">*</span></label>
            {schemes?.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {schemes.map(s => {
                  const selected = (form.scheme || '').split(',').map(x => x.trim()).filter(Boolean).includes(s);
                  return (
                    <label key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors select-none ${selected ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-400 text-brand-700 dark:text-brand-300 font-medium' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300'}`}>
                      <input type="checkbox" className="hidden" checked={selected} onChange={() => {
                        const current = (form.scheme || '').split(',').map(x => x.trim()).filter(Boolean);
                        const next = selected ? current.filter(x => x !== s) : [...current, s];
                        setForm(f => ({ ...f, scheme: next.join(',') }));
                      }} />
                      {s.replace(/_/g, ' ')}
                    </label>
                  );
                })}
              </div>
            ) : (
              <input className="input" value={form.scheme} onChange={e => setForm(f => ({ ...f, scheme: e.target.value }))} placeholder="No schemes configured — type manually or add in Platform Settings" />
            )}
          </div>
        )}
        <div className="col-span-2">
          <label className="label">Phone (optional)</label>
          <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label className="label">Proof Type</label>
          <select className="input" value={form.proof_type} onChange={e => setForm(f => ({ ...f, proof_type: e.target.value }))}>
            {PROOF_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Proof Number (optional)</label>
          <input className="input uppercase" value={form.proof} onChange={e => setForm(f => ({ ...f, proof: e.target.value.toUpperCase() }))} placeholder={form.proof_type === 'pan_card' ? 'e.g. ABCDE1234F' : 'e.g. 1234 5678 9012'} />
        </div>
        {!isCreate && !form.is_active && (
          <div className="col-span-2">
            <label className="label">Terminated Date</label>
            <input type="date" className="input" value={form.terminated_at} onChange={e => setForm(f => ({ ...f, terminated_at: e.target.value }))} />
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

function UserTable({ users, tab, openEdit, openReset, openToggle, openDelete, openSchemes, isSuperAdmin }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [sort, setSort] = useState({ col: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const isClient = tab === 'client';
  const isEmployee = tab === 'employee';
  const isShareholder = tab === 'shareholder';

  const allToggleCols = isClient
    ? ['email', 'scheme', 'manager', 'status', 'joined']
    : ['email', 'role', 'status', 'joined'];
  const colLabels = { email: 'Email', scheme: 'Scheme', manager: 'Manager', role: 'Role', status: 'Status', joined: 'Joined' };

  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(`users_${tab}_cols`) || 'null'); return s ? new Set(s) : new Set(allToggleCols); } catch { return new Set(allToggleCols); }
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const toggleCol = col => setVisibleCols(prev => {
    const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col);
    localStorage.setItem(`users_${tab}_cols`, JSON.stringify([...next])); return next;
  });

  // Derive unique schemes from users in this tab
  const allSchemes = isClient
    ? [...new Set(users.flatMap(u => (u.scheme || '').split(',').map(s => s.trim()).filter(Boolean)))].sort()
    : [];

  const preStatus = users.filter(u => {
    const matchSearch = !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchScheme = !isClient || schemeFilter === 'all' || (u.scheme || '').split(',').map(s => s.trim()).includes(schemeFilter);
    return matchSearch && matchScheme;
  });

  const filtered = preStatus.filter(u =>
    statusFilter === 'all' ? true : statusFilter === 'active' ? u.is_active : !u.is_active
  );

  const toggleSort = (col) => { setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }); setPage(1); };
  const sorted = [...filtered].sort((a, b) => {
    const v1 = a[sort.col] ?? '', v2 = b[sort.col] ?? '';
    const cmp = typeof v1 === 'boolean' ? (v1 === v2 ? 0 : v1 ? -1 : 1) : String(v1).localeCompare(String(v2), undefined, { numeric: true });
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / limit) || 1;
  const paged = sorted.slice((page - 1) * limit, page * limit);

  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <ChevronsUpDown size={13} className="ml-1 text-gray-400 inline" />;
    return sort.dir === 'asc' ? <ChevronUp size={13} className="ml-1 text-brand-600 inline" /> : <ChevronDown size={13} className="ml-1 text-brand-600 inline" />;
  };
  const SortTh = ({ col, children }) => (
    <Th><button onClick={() => toggleSort(col)} className="flex items-center gap-0.5 hover:text-brand-600 transition-colors">{children}<SortIcon col={col} /></button></Th>
  );

  // columns differ per tab
  const colCount = visibleCols.size + 1 + (isSuperAdmin ? 1 : 0);

  return (
    <div className="card">
      {/* Status tabs + toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-0">
        <div className="flex">
          {[
            { key: 'all',      label: 'All',      count: preStatus.length },
            { key: 'active',   label: 'Active',   count: preStatus.filter(u => u.is_active).length },
            { key: 'inactive', label: 'Inactive', count: preStatus.filter(u => !u.is_active).length },
          ].map(t => (
            <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${statusFilter === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === t.key ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="relative">
            <button onClick={() => setColMenuOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
              <Columns size={12} /> Columns <span className="text-brand-600 dark:text-brand-400">{visibleCols.size}</span>
            </button>
            {colMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-40">
                {allToggleCols.map(col => (
                  <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={visibleCols.has(col)} onChange={() => toggleCol(col)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    {colLabels[col]}
                  </label>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
            {[5, 10, 15, 20, 25].map(n => (
              <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                className={`px-2.5 py-1 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="pl-8 pr-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
              placeholder={`Search ${tab}s…`} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>

      {/* Scheme filter — client tab only */}
      {isClient && allSchemes.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Scheme:</span>
          {['all', ...allSchemes].map(s => (
            <button key={s} onClick={() => { setSchemeFilter(s); setPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${schemeFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      <Table>
        <thead>
          <tr>
            <SortTh col="name">Name</SortTh>
            {visibleCols.has('email') && <SortTh col="email">Email</SortTh>}
            {isClient && visibleCols.has('scheme') && <SortTh col="scheme">Scheme</SortTh>}
            {isClient && visibleCols.has('manager') && <SortTh col="shareholder_name">Manager</SortTh>}
            {(isEmployee || isShareholder) && visibleCols.has('role') && <SortTh col="role">Role</SortTh>}
            {visibleCols.has('status') && <SortTh col="is_active">Status</SortTh>}
            {visibleCols.has('joined') && <SortTh col="created_at">Joined</SortTh>}
            {isSuperAdmin && <Th>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {!sorted.length && <EmptyRow cols={colCount} message={`No ${tab}s found`} />}
          {paged.map(u => (
            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <Td className="font-medium text-gray-900 dark:text-white">{u.name}</Td>
              {visibleCols.has('email') && <Td className="text-gray-500">{u.email}</Td>}
              {isClient && visibleCols.has('scheme') && (
                <Td>
                  {u.scheme
                    ? <div className="flex flex-wrap gap-1">{u.scheme.split(',').map(s => s.trim()).filter(Boolean).map(s => <span key={s} className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{s.replace(/_/g, ' ')}</span>)}</div>
                    : <span className="text-gray-400 text-xs">—</span>}
                </Td>
              )}
              {isClient && visibleCols.has('manager') && <Td className="text-gray-500 text-xs">{u.shareholder_name || '—'}</Td>}
              {(isEmployee || isShareholder) && visibleCols.has('role') && (
                <Td><span className={u.role === 'super_admin' ? 'badge-red' : u.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{u.role.replace('_', ' ')}</span></Td>
              )}
              {visibleCols.has('status') && <Td><span className={u.is_active ? 'badge-green' : 'badge-red'}>{u.is_active ? 'Active' : 'Inactive'}</span></Td>}
              {visibleCols.has('joined') && <Td className="text-gray-500 text-xs">{fmt.date(u.created_at)}</Td>}
              {isSuperAdmin && (
                <Td>
                  <div className="flex items-center gap-1">
                    {[
                      { label: 'Edit', icon: <Edit2 size={15} />, color: 'hover:text-brand-600', onClick: () => openEdit(u) },
                      { label: 'Reset Password', icon: <Key size={15} />, color: 'hover:text-orange-600', onClick: () => openReset(u) },
                      { label: u.is_active ? 'Deactivate' : 'Activate', icon: u.is_active ? <UserX size={15} /> : <UserCheck size={15} />, color: 'hover:text-blue-600', onClick: () => openToggle(u) },
                      ...(isClient && u.scheme ? [{ label: 'Manage Schemes', icon: <Layers size={15} />, color: 'hover:text-purple-600', onClick: () => openSchemes(u) }] : []),
                      { label: 'Delete', icon: <Trash2 size={15} />, color: 'hover:text-red-600', onClick: () => openDelete(u) },
                    ].map(({ label, icon, color, onClick }) => (
                      <div key={label} className="relative group/tip">
                        <button onClick={onClick} className={`p-1 text-gray-400 ${color} transition-colors`}>{icon}</button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-lg">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </Td>
              )}
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
  );
}

export default function UsersPage() {
  const { user: authUser } = useAuth();
  const isSuperAdmin = authUser?.role === 'super_admin';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('shareholder');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pwForm, setPwForm] = useState({ new_password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userTypes, setUserTypes] = useState(['client', 'shareholder']);
  const [roles, setRoles] = useState(['user', 'admin', 'super_admin']);
  const [schemes, setSchemes] = useState([]);
  const [schemeStatuses, setSchemeStatuses] = useState([]);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/users'),
      api.get('/config'),
    ]).then(([u, c]) => {
      setUsers(u.data);
      if (c.data.user_types?.length) setUserTypes(c.data.user_types);
      if (c.data.roles?.length) setRoles(c.data.roles);
      if (c.data.schemes?.length) setSchemes(c.data.schemes);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const tabUsers = users.filter(u => tabFilter(u, activeTab));

  const openCreate = () => {
    const defaultType = activeTab === 'employee' ? 'shareholder' : activeTab;
    const defaultRole = activeTab === 'employee' ? 'admin' : 'user';
    setForm({ ...EMPTY_FORM, user_type: defaultType, role: defaultRole });
    setError('');
    setModal('create');
  };
  const openEdit = (u) => { setSelected(u); setForm({ name: u.name, email: u.email, password: '', user_type: u.user_type, role: u.role, phone: u.phone || '', scheme: u.scheme || '', proof_type: u.proof_type || 'pan_card', proof: u.proof || '', is_active: u.is_active, terminated_at: u.terminated_at ? u.terminated_at.split('T')[0] : '' }); setError(''); setModal('edit'); };
  const openReset = (u) => { setSelected(u); setPwForm({ new_password: '' }); setError(''); setModal('reset-pw'); };
  const openDelete = (u) => { setSelected(u); setModal('delete'); };
  const openToggle = async (u) => {
    try { await api.put(`/users/${u.id}`, { is_active: !u.is_active }); load(); } catch (err) { alert(err.message); }
  };

  const openSchemes = async (u) => {
    setSelected(u);
    setSchemeLoading(true);
    setModal('schemes');
    try {
      const res = await api.get(`/users/${u.id}/schemes`);
      setSchemeStatuses(res.data);
    } catch (err) { alert(err.message); }
    finally { setSchemeLoading(false); }
  };

  const toggleScheme = async (scheme, currentActive) => {
    try {
      const res = await api.put(`/users/${selected.id}/schemes/${encodeURIComponent(scheme)}`, { is_active: !currentActive });
      setSchemeStatuses(prev => prev.map(s => s.scheme === scheme ? { ...s, is_active: res.data.is_active } : s));
      showToast(`${scheme.replace(/_/g, ' ')} marked as ${res.data.is_active ? 'active' : 'inactive'}`);
    } catch (err) { alert(err.message); }
  };

  const submitCreate = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try { await api.post('/users', form); setModal(null); load(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const submitEdit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try { await api.put(`/users/${selected.id}`, form); setModal(null); load(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const submitReset = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try { await api.put(`/users/${selected.id}/reset-password`, pwForm); setModal(null); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const submitDelete = async () => {
    setSaving(true);
    try { await api.delete(`/users/${selected.id}`); setModal(null); load(); } catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonSearchBar />
      <SkeletonTable rows={8} cols={7} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} total users</p>
        </div>
        {isSuperAdmin && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New User
          </button>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {TABS.map(t => {
          const count = users.filter(u => tabFilter(u, t.key)).length;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === t.key ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table for active tab */}
      <UserTable
        key={activeTab}
        users={tabUsers}
        tab={activeTab}
        openEdit={openEdit}
        openReset={openReset}
        openToggle={openToggle}
        openDelete={openDelete}
        openSchemes={openSchemes}
        isSuperAdmin={isSuperAdmin}
      />

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Create User">
        <UserForm form={form} setForm={setForm} onSubmit={submitCreate} onCancel={() => setModal(null)} isCreate saving={saving} error={error} userTypes={userTypes} roles={roles} schemes={schemes} />
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit User">
        <UserForm form={form} setForm={setForm} onSubmit={submitEdit} onCancel={() => setModal(null)} isCreate={false} saving={saving} error={error} userTypes={userTypes} roles={roles} schemes={schemes} />
      </Modal>
      <Modal open={modal === 'reset-pw'} onClose={() => setModal(null)} title="Reset Password">
        <form onSubmit={submitReset} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <p className="text-sm text-gray-600 dark:text-gray-400">Resetting password for <strong>{selected?.name}</strong></p>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={pwForm.new_password} onChange={e => setPwForm({ new_password: e.target.value })} required minLength={6} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Resetting...' : 'Reset Password'}</button>
          </div>
        </form>
      </Modal>
      <Modal open={modal === 'schemes'} onClose={() => setModal(null)} title={`Scheme Status — ${selected?.name}`} size="sm">
        <div className="space-y-3">
          {schemeLoading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
          ) : schemeStatuses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No schemes assigned.</p>
          ) : (
            schemeStatuses.map(s => (
              <div key={s.scheme} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{s.scheme.replace(/_/g, ' ')}</span>
                <button
                  onClick={() => toggleScheme(s.scheme, s.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${s.is_active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${s.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))
          )}
          <div className="pt-1 flex justify-end">
            <button onClick={() => setModal(null)} className="btn-secondary">Close</button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete User">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete <strong>{selected?.name}</strong>? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submitDelete} disabled={saving} className="btn-danger flex-1">{saving ? 'Deleting...' : 'Delete'}</button>
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
