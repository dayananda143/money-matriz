import { useEffect, useState, useMemo } from 'react';
import { Plus, Users, UserPlus, Search, X, ChevronRight, UserCheck } from 'lucide-react';
import api from '../../api';
import { SkeletonPageHeader } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';

export default function RelationshipsPage() {
  const { user: authUser } = useAuth();
  const isSuperAdmin = authUser?.role === 'super_admin';
  const [rels, setRels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // Add manager modal
  const [addManagerOpen, setAddManagerOpen] = useState(false);
  const [addManagerId, setAddManagerId] = useState('');

  // Add client panel
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [adding, setAdding] = useState(null);

  // Client search
  const [clientSearch, setClientSearch] = useState('');

  // Enrolled manager IDs (shareholders explicitly added to the panel)
  const [enrolledIds, setEnrolledIds] = useState([]);

  // Confirm delete dialog
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }

  // Unassigned clients modal
  const [showUnassigned, setShowUnassigned] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/relationships'),
      api.get('/users'),
    ]).then(([r, u]) => {
      setRels(r.data);
      setUsers(u.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Auto-enroll shareholders who already have relationships
  useEffect(() => {
    if (!loading && rels.length > 0) {
      const idsWithRels = [...new Set(rels.map(r => r.shareholder_id))];
      setEnrolledIds(prev => [...new Set([...prev, ...idsWithRels])]);
    }
  }, [loading, rels]);

  const shareholders = useMemo(() => users.filter(u => u.user_type === 'shareholder'), [users]);
  const clients = useMemo(() => users.filter(u => u.user_type === 'client'), [users]);

  // Only enrolled shareholders appear in left panel
  const enrolledShareholders = shareholders.filter(s => enrolledIds.includes(s.id));
  // Shareholders not yet enrolled (available to add)
  const unenrolledShareholders = shareholders.filter(s => !enrolledIds.includes(s.id));

  const selected = shareholders.find(s => s.id === selectedId) || null;
  const assignedRels = rels.filter(r => r.shareholder_id === selectedId);
  const assignedClientIds = new Set(assignedRels.map(r => r.client_id));
  const allAssignedClientIds = new Set(rels.map(r => r.client_id));

  const unassignedClients = clients.filter(c => !assignedClientIds.has(c.id));
  const filteredUnassigned = unassignedClients.filter(c =>
    !addSearch.trim() || c.name.toLowerCase().includes(addSearch.toLowerCase()) || c.email.toLowerCase().includes(addSearch.toLowerCase())
  );
  const filteredAssigned = assignedRels.filter(r =>
    !clientSearch.trim() || r.client_name?.toLowerCase().includes(clientSearch.toLowerCase()) || r.client_email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const enrollManager = () => {
    if (!addManagerId) return;
    const id = parseInt(addManagerId);
    setEnrolledIds(prev => [...new Set([...prev, id])]);
    setSelectedId(id);
    setAddManagerOpen(false);
    setAddManagerId('');
    setAddOpen(false);
    setClientSearch('');
  };

  const removeManager = (shId) => {
    setConfirmDialog({
      message: 'Remove this shareholder from the panel? Their client relationships will not be deleted.',
      onConfirm: () => {
        setEnrolledIds(prev => prev.filter(id => id !== shId));
        if (selectedId === shId) setSelectedId(enrolledIds.find(id => id !== shId) || null);
        setConfirmDialog(null);
      }
    });
  };

  const addClient = async (clientId) => {
    setAdding(clientId);
    try {
      await api.post('/relationships', { shareholder_id: selectedId, client_id: clientId });
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setAdding(null); }
  };

  const removeRel = (id) => {
    setConfirmDialog({
      message: 'Remove this client from the shareholder?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try { await api.delete(`/relationships/${id}`); load(); } catch (err) { alert(err.message); }
      }
    });
  };

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
    </div>
  );

  const totalUnassigned = clients.filter(c => c.is_active && !allAssignedClientIds.has(c.id)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relationships</h1>
          <p className="text-gray-500 text-sm mt-1">
            {rels.length} assignments
            {totalUnassigned > 0 && (
              <button onClick={() => setShowUnassigned(true)} className="text-red-500 ml-1 hover:text-red-700 hover:underline transition-colors">
                · {totalUnassigned} unassigned client{totalUnassigned !== 1 ? 's' : ''}
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-4 min-h-[520px]">

        {/* Left: Enrolled shareholder cards */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Managers</p>
            {isSuperAdmin && (
              <button onClick={() => { setAddManagerOpen(true); setAddManagerId(''); }}
                disabled={unenrolledShareholders.length === 0}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Plus size={13} /> Add Manager
              </button>
            )}
          </div>

          {enrolledShareholders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <UserCheck size={28} className="text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">No managers added.</p>
              {isSuperAdmin && (
                <button onClick={() => setAddManagerOpen(true)}
                  className="mt-3 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                  + Add Manager
                </button>
              )}
            </div>
          ) : (
            enrolledShareholders.map(sh => {
              const shRels = rels.filter(r => r.shareholder_id === sh.id);
              const isSelected = sh.id === selectedId;
              return (
                <div key={sh.id} className="flex items-start gap-1">
                  <button onClick={() => { setSelectedId(sh.id); setAddOpen(false); setClientSearch(''); setAddSearch(''); }}
                    className={`flex-1 flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-400 dark:border-brand-500 shadow-sm' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5 ${isSelected ? 'bg-brand-600 text-white' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'}`}>
                      {sh.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`font-medium text-sm truncate ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>{sh.name}</p>
                        <ChevronRight size={13} className={`flex-shrink-0 ${isSelected ? 'text-brand-500' : 'text-gray-300'}`} />
                      </div>
                      <p className="text-xs text-gray-400 truncate">{sh.email}</p>
                      {shRels.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{shRels.length} client{shRels.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </button>
                  {isSuperAdmin && (
                    <button onClick={() => removeManager(sh.id)}
                      className="mt-1 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Client panel */}
        <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Users size={36} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-400">Select a manager to manage clients</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
                    {selected.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{selected.name}</p>
                    {assignedRels.length > 0 && (
                      <p className="text-xs text-gray-400">{assignedRels.length} client{assignedRels.length !== 1 ? 's' : ''} assigned</p>
                    )}
                  </div>
                </div>
                {isSuperAdmin && (
                  <button onClick={() => { setAddOpen(o => !o); setAddSearch(''); }}
                    className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${addOpen ? 'bg-brand-600 text-white' : 'btn-primary'}`}>
                    <UserPlus size={14} /> Add Client
                  </button>
                )}
              </div>

              {addOpen && (
                <div className="px-5 py-3 border-b border-brand-100 dark:border-brand-900/30 bg-brand-50/50 dark:bg-brand-900/10">
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input autoFocus
                      className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-full"
                      placeholder="Search clients…"
                      value={addSearch} onChange={e => setAddSearch(e.target.value)} />
                  </div>
                  {filteredUnassigned.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2 text-center">No clients available to add.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {filteredUnassigned.map(c => (
                        <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email}</p>
                          </div>
                          <button onClick={() => addClient(c.id)} disabled={adding === c.id}
                            className="ml-3 flex-shrink-0 flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-800 disabled:opacity-50 transition-colors">
                            <Plus size={13} />{adding === c.id ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {assignedRels.length > 0 && (
                <div className="px-5 py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-full"
                      placeholder="Search clients…" value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {assignedRels.length === 0 ? null : filteredAssigned.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">No clients match your search.</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {filteredAssigned.map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-semibold text-xs flex-shrink-0">
                          {r.client_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.client_name}</p>
                          <p className="text-xs text-gray-400 truncate">{r.client_email}</p>
                          {r.client_scheme && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.client_scheme.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                                <span key={s} className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">
                                  {s.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isSuperAdmin && (
                          <button onClick={() => removeRel(r.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Manager Modal */}
      <Modal open={addManagerOpen} onClose={() => setAddManagerOpen(false)} title="Add Manager" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Shareholder</label>
            <select className="input w-full" value={addManagerId} onChange={e => setAddManagerId(e.target.value)}>
              <option value="">Select shareholder...</option>
              {unenrolledShareholders.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setAddManagerOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={enrollManager} disabled={!addManagerId} className="btn-primary">Add</button>
          </div>
        </div>
      </Modal>

      {/* Unassigned Clients Modal */}
      <Modal open={showUnassigned} onClose={() => setShowUnassigned(false)} title="Unassigned Clients" size="md">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalUnassigned} active client{totalUnassigned !== 1 ? 's' : ''} not assigned to any manager.
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {clients.filter(c => c.is_active && !allAssignedClientIds.has(c.id)).map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 font-semibold text-xs flex-shrink-0">
                  {c.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                </div>
                <div className="flex-shrink-0">
                  {c.scheme ? (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {c.scheme.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">
                          {s.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No scheme</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={() => setShowUnassigned(false)} className="btn-secondary">Close</button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <Modal open={!!confirmDialog} onClose={() => setConfirmDialog(null)} title="Confirm Delete" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{confirmDialog?.message}</p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setConfirmDialog(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmDialog?.onConfirm} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
