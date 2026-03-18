import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';

export default function RelationshipsPage() {
  const [rels, setRels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ shareholder_id: '', client_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/relationships'),
      api.get('/users')
    ]).then(([r, u]) => {
      setRels(r.data);
      setUsers(u.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const shareholders = users.filter(u => u.user_type === 'shareholder');
  const clients = users.filter(u => u.user_type === 'client');
  const unassignedClients = clients.filter(c => !rels.find(r => r.client_id == c.id) || form.client_id == c.id);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/relationships', form);
      setModal(false); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const deleteRel = async (id) => {
    if (!confirm('Remove this relationship?')) return;
    try { await api.delete(`/relationships/${id}`); load(); } catch (err) { alert(err.message); }
  };

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} cols="grid-cols-1 sm:grid-cols-3" />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relationships</h1>
          <p className="text-gray-500 text-sm mt-1">Shareholder → Client assignments</p>
        </div>
        <button onClick={() => { setForm({ shareholder_id: '', client_id: '' }); setError(''); setModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Assign Client
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Relationships</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{rels.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Clients Assigned</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{rels.length} / {clients.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Unassigned Clients</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{clients.length - rels.length}</p>
        </div>
      </div>

      <div className="card">
        <Table>
          <thead>
            <tr><Th>Shareholder</Th><Th>Client</Th><Th>Client Email</Th><Th>Assigned</Th><Th>Actions</Th></tr>
          </thead>
          <tbody>
            {!rels.length && <EmptyRow cols={5} message="No relationships defined" />}
            {rels.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>
                  <p className="font-medium text-gray-900 dark:text-white">{r.shareholder_name}</p>
                  <p className="text-xs text-gray-500">{r.shareholder_email}</p>
                </Td>
                <Td className="font-medium text-gray-900 dark:text-white">{r.client_name}</Td>
                <Td className="text-gray-500">{r.client_email}</Td>
                <Td className="text-gray-500 text-xs">{fmt.date(r.created_at)}</Td>
                <Td>
                  <button onClick={() => deleteRel(r.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Assign Client to Shareholder">
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Shareholder</label>
            <select className="input" value={form.shareholder_id} onChange={e => setForm(f => ({ ...f, shareholder_id: e.target.value }))} required>
              <option value="">Select shareholder...</option>
              {shareholders.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">If the client is already assigned to another shareholder, they will be reassigned.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Assigning...' : 'Assign'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
