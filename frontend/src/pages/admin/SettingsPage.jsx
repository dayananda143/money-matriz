import { useEffect, useState } from 'react';
import { Plus, X, Check, Loader2 } from 'lucide-react';
import api from '../../api';
import { Skeleton, SkeletonPageHeader } from '../../components/ui/Skeleton';

function TagList({ label, description, configKey, items, onSaved }) {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const persist = async (newItems) => {
    setSaving(true);
    try {
      await api.put(`/config/${configKey}`, { values: newItems });
      onSaved(configKey, newItems);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const val = input.trim().toLowerCase().replace(/\s+/g, '_');
    if (!val || items.includes(val)) return;
    persist([...items, val]);
    setInput('');
  };

  const remove = (item) => persist(items.filter(i => i !== item));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900 dark:text-white">{label}</h3>
        <span className="flex items-center gap-1 text-xs">
          {saving && <><Loader2 size={12} className="animate-spin text-gray-400" /><span className="text-gray-400">Saving...</span></>}
          {!saving && saved && <><Check size={12} className="text-green-500" /><span className="text-green-500">Saved</span></>}
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{description}</p>

      <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
        {items.map(item => (
          <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
            {item}
            <button type="button" onClick={() => remove(item)} className="hover:text-red-500 transition-colors">
              <X size={13} />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-gray-400">No values defined</span>}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Add new value (e.g. investor)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button type="button" onClick={add} className="btn-primary flex items-center gap-1 px-3">
          <Plus size={16} /> Add
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">Spaces are converted to underscores. Press Enter or click Add.</p>
    </div>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState({ user_types: [], roles: [], schemes: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/config')
      .then(r => setConfig(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (key, values) => {
    setConfig(c => ({ ...c, [key]: values }));
  };

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="card p-5 space-y-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-20 w-full" /></div>
      <div className="card p-5 space-y-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-20 w-full" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Changes are saved automatically when you add or remove a value.</p>
      </div>

      <TagList
        label="User Types"
        description="Available types when creating a user. Each type determines which dashboard the user sees."
        configKey="user_types"
        items={config.user_types || []}
        onSaved={handleSaved}
      />

      <TagList
        label="Roles"
        description="Available roles when creating a user. Roles control permissions and access levels."
        configKey="roles"
        items={config.roles || []}
        onSaved={handleSaved}
      />

      <TagList
        label="Schemes"
        description="Investment schemes available for clients. Shown when creating or editing a client user."
        configKey="schemes"
        items={config.schemes || []}
        onSaved={handleSaved}
      />

      <TagList
        label="Share Types"
        description="Investment categories used in Shares (e.g. FD &amp; RD, Investment into stocks, Investment into company)."
        configKey="share_types"
        items={config.share_types || []}
        onSaved={handleSaved}
      />

      <div className="card p-5 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold text-amber-800 dark:text-amber-400">Important Notes</h3>
        <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-500 list-disc list-inside">
          <li>Removing a type or role does not affect existing users — they keep their current values.</li>
          <li>The <strong>super_admin</strong> role has full system access — keep at least one.</li>
          <li>New types beyond <em>client</em> and <em>shareholder</em> will use the client dashboard by default until custom routing is configured.</li>
        </ul>
      </div>
    </div>
  );
}
