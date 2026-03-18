import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Key, UserCheck, UserX, Eye, EyeOff, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonSearchBar, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

const EMPTY_FORM = { name: '', email: '', password: 'changeme', user_type: 'client', role: 'user', phone: '', scheme: '', proof_type: 'pan_card', proof: '', is_active: true, terminated_at: '' };
const PROOF_TYPES = [{ value: 'pan_card', label: 'PAN Card' }, { value: 'aadhar_card', label: 'Aadhar Card' }];

function UserForm({ form, setForm, onSubmit, onCancel, isCreate, saving, error, userTypes, roles, schemes }) {
  const [showPw, setShowPw] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
            <label className="label">Schemes (optional)</label>
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

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState({ col: 'name', dir: 'asc' });
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pwForm, setPwForm] = useState({ new_password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userTypes, setUserTypes] = useState(['client', 'shareholder']);
  const [roles, setRoles] = useState(['user', 'admin', 'super_admin']);
  const [schemes, setSchemes] = useState([]);

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

  const filtered = users.filter(u => {
    const matchType = typeFilter === 'all' || u.user_type === typeFilter;
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active);
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchType && matchRole && matchStatus && matchSearch;
  });

  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  const sorted = [...filtered].sort((a, b) => {
    const v1 = a[sort.col] ?? '', v2 = b[sort.col] ?? '';
    const cmp = typeof v1 === 'boolean' ? (v1 === v2 ? 0 : v1 ? -1 : 1) : String(v1).localeCompare(String(v2), undefined, { numeric: true });
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <ChevronsUpDown size={13} className="ml-1 text-gray-400 inline" />;
    return sort.dir === 'asc' ? <ChevronUp size={13} className="ml-1 text-brand-600 inline" /> : <ChevronDown size={13} className="ml-1 text-brand-600 inline" />;
  };
  const SortTh = ({ col, children }) => (
    <Th><button onClick={() => toggleSort(col)} className="flex items-center gap-0.5 hover:text-brand-600 transition-colors">{children}<SortIcon col={col} /></button></Th>
  );

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModal('create'); };
  const openEdit = (u) => { setSelected(u); setForm({ name: u.name, email: u.email, password: '', user_type: u.user_type, role: u.role, phone: u.phone || '', scheme: u.scheme || '', proof_type: u.proof_type || 'pan_card', proof: u.proof || '', is_active: u.is_active, terminated_at: u.terminated_at ? u.terminated_at.split('T')[0] : '' }); setError(''); setModal('edit'); };
  const openReset = (u) => { setSelected(u); setPwForm({ new_password: '' }); setError(''); setModal('reset-pw'); };
  const openDelete = (u) => { setSelected(u); setModal('delete'); };
  const openToggle = async (u) => {
    try { await api.put(`/users/${u.id}`, { is_active: !u.is_active }); load(); } catch (err) { alert(err.message); }
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
      <SkeletonTable rows={8} cols={9} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} of {users.length} users</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New User
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Type:</span>
            {['all', ...userTypes].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${typeFilter === t ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Role:</span>
            {['all', ...roles].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${roleFilter === r ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                {r.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Status:</span>
            {['all', 'active', 'inactive'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <Table>
          <thead>
            <tr>
              <SortTh col="name">Name</SortTh>
              <SortTh col="email">Email</SortTh>
              <SortTh col="user_type">Type</SortTh>
              <SortTh col="scheme">Scheme</SortTh>
              <SortTh col="role">Role</SortTh>
              <SortTh col="shareholder_name">Manager</SortTh>
              <SortTh col="is_active">Status</SortTh>
              <SortTh col="created_at">Joined</SortTh>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length && <EmptyRow cols={9} message="No users found" />}
            {sorted.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td className="font-medium text-gray-900 dark:text-white">{u.name}</Td>
                <Td className="text-gray-500">{u.email}</Td>
                <Td><span className={u.user_type === 'shareholder' ? 'badge-blue' : 'badge-gray'}>{u.user_type}</span></Td>
                <Td>
                  {u.scheme
                    ? <div className="flex flex-wrap gap-1">{u.scheme.split(',').map(s => s.trim()).filter(Boolean).map(s => <span key={s} className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{s.replace(/_/g, ' ')}</span>)}</div>
                    : <span className="text-gray-400 text-xs">—</span>}
                </Td>
                <Td><span className={u.role === 'super_admin' ? 'badge-red' : u.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{u.role.replace('_', ' ')}</span></Td>
                <Td className="text-gray-500 text-xs">{u.shareholder_name || '—'}</Td>
                <Td><span className={u.is_active ? 'badge-green' : 'badge-red'}>{u.is_active ? 'Active' : 'Inactive'}</span></Td>
                <Td className="text-gray-500 text-xs">{fmt.date(u.created_at)}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(u)} className="p-1 text-gray-400 hover:text-brand-600" title="Edit"><Edit2 size={15} /></button>
                    <button onClick={() => openReset(u)} className="p-1 text-gray-400 hover:text-orange-600" title="Reset password"><Key size={15} /></button>
                    <button onClick={() => openToggle(u)} className="p-1 text-gray-400 hover:text-blue-600" title={u.is_active ? 'Deactivate' : 'Activate'}>
                      {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                    </button>
                    <button onClick={() => openDelete(u)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

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
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete User">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete <strong>{selected?.name}</strong>? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submitDelete} disabled={saving} className="btn-danger flex-1">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
