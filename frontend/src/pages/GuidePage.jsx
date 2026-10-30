import { useMemo, useState } from 'react';
import { Search, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GUIDE } from '../content/guide';

// Matches a task against what was typed, across its question, body and steps, so
// searching for "brokerage" finds the task that mentions it halfway down.
function matches(item, needle) {
  if (!needle) return true;
  const hay = [item.q, item.body, item.note, ...(item.steps || [])].join(' ').toLowerCase();
  return hay.includes(needle);
}

export default function GuidePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const role = (user?.role === 'admin' || user?.role === 'super_admin')
    ? 'admin'
    : user?.user_type === 'shareholder' ? 'shareholder' : 'client';

  const needle = search.trim().toLowerCase();

  const sections = useMemo(() => GUIDE
    .filter(s => s.roles.includes(role))
    .map(s => ({
      ...s,
      items: s.items
        .filter(i => !i.roles || i.roles.includes(role))
        .filter(i => matches(i, needle)),
    }))
    .filter(s => s.items.length), [role, needle]);

  const found = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guide</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          How to do the things this system is for. Search, or open a task to see the steps.
        </p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          id="guide-search"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search — try “brokerage”, “sell”, “settle”"
          className="input pl-9 pr-9"
          aria-label="Search the guide"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={15} />
          </button>
        )}
      </div>

      {needle && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {found === 0 ? 'Nothing matches that.' : `${found} ${found === 1 ? 'task' : 'tasks'} match.`}
        </p>
      )}

      {sections.map(section => (
        <section key={section.id} className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            {section.title}
          </h2>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            {section.items.map(item => {
              const id = `${section.id}-${item.q}`;
              const isOpen = open === id || !!needle;
              return (
                <div key={id} className="bg-white dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen && !needle ? null : id)}
                    aria-expanded={isOpen}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{item.q}</span>
                    <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 -mt-1 space-y-3">
                      {item.body && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{item.body}</p>
                      )}
                      {item.steps && (
                        <ol className="space-y-2">
                          {item.steps.map((s, i) => (
                            <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white text-xs grid place-items-center mt-0.5">
                                {i + 1}
                              </span>
                              <span className="leading-relaxed">{s}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {item.note && (
                        <div className="flex gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-3 py-2.5">
                          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{item.note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
