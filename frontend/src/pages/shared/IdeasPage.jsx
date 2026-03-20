import { useEffect, useState } from 'react';
import { Lightbulb, Pencil, Trash2, Plus, X, CheckCircle2, Clock } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { fmt } from '../../utils/format';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: Clock,         cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  implemented: { label: 'Implemented', icon: CheckCircle2,  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function IdeaCard({ idea, currentUser, onEdit, onDelete, onToggleStatus }) {
  const isOwner = idea.user_id === currentUser.id;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const canModify = isOwner || isAdmin;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{idea.title}</h3>
          <StatusBadge status={idea.status} />
        </div>
        {canModify && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {isAdmin && (
              <button
                onClick={() => onToggleStatus(idea)}
                title={idea.status === 'pending' ? 'Mark as Implemented' : 'Mark as Pending'}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${idea.status === 'implemented' ? 'text-green-500' : 'text-gray-400 hover:text-green-600'}`}>
                <CheckCircle2 size={13} />
              </button>
            )}
            <button onClick={() => onEdit(idea)} className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => onDelete(idea)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{idea.content}</p>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-xs">
            {idea.author_name?.[0]?.toUpperCase()}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{idea.author_name}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">{fmt.datetime(idea.created_at)}</span>
      </div>
    </div>
  );
}

function IdeaModal({ idea, open, onClose, onSaved, isAdmin }) {
  const [form, setForm] = useState({ title: '', content: '', status: 'pending' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ title: idea?.title || '', content: idea?.content || '', status: idea?.status || 'pending' });
      setError('');
    }
  }, [open, idea]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (idea) {
        const { data } = await api.put(`/ideas/${idea.id}`, form);
        onSaved(data, 'edit');
      } else {
        const { data } = await api.post('/ideas', form);
        onSaved(data, 'add');
      }
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">{idea ? 'Edit Idea' : 'New Idea'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Idea title..." value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Details</label>
            <textarea className="input min-h-[120px] resize-y" placeholder="Describe your idea..." value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required />
          </div>
          {isAdmin && <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <button key={val} type="button"
                  onClick={() => setForm(f => ({ ...f, status: val }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    form.status === val
                      ? val === 'implemented' ? 'bg-green-50 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400'
                                              : 'bg-yellow-50 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  <cfg.icon size={14} /> {cfg.label}
                </button>
              ))}
            </div>
          </div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : idea ? 'Save Changes' : 'Post Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function IdeasPage() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdea, setEditIdea] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    api.get('/ideas').then(r => setIdeas(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSaved = (idea, mode) => {
    if (mode === 'add') setIdeas(prev => [idea, ...prev]);
    else setIdeas(prev => prev.map(i => i.id === idea.id ? idea : i));
  };

  const toggleStatus = async (idea) => {
    const newStatus = idea.status === 'pending' ? 'implemented' : 'pending';
    try {
      const { data } = await api.put(`/ideas/${idea.id}`, { status: newStatus });
      setIdeas(prev => prev.map(i => i.id === idea.id ? data : i));
    } catch (err) { alert(err.message); }
  };

  const openEdit = (idea) => { setEditIdea(idea); setModalOpen(true); };
  const openNew = () => { setEditIdea(null); setModalOpen(true); };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/ideas/${deleteTarget.id}`);
      setIdeas(prev => prev.filter(i => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) { alert(err.message); } finally { setDeleting(false); }
  };

  const filtered = filterStatus === 'all' ? ideas : ideas.filter(i => i.status === filterStatus);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <Lightbulb size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ideas Board</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Share and discuss investment ideas</p>
          </div>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> New Idea
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'pending', 'implemented'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
            {s === 'all' ? `All (${ideas.length})` : `${STATUS_CONFIG[s].label} (${ideas.filter(i => i.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{ideas.length === 0 ? 'No ideas yet. Be the first to share one!' : 'No ideas match this filter.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(idea => (
            <IdeaCard key={idea.id} idea={idea} currentUser={user} onEdit={openEdit} onDelete={setDeleteTarget} onToggleStatus={toggleStatus} />
          ))}
        </div>
      )}

      <IdeaModal open={modalOpen} idea={editIdea} onClose={() => setModalOpen(false)} onSaved={handleSaved} isAdmin={user?.role === 'admin' || user?.role === 'super_admin'} />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Delete Idea</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Delete <strong>"{deleteTarget.title}"</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
