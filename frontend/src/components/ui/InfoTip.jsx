import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

// A short explanation attached to the thing it explains. Opens on hover for a
// mouse and on click for touch and keyboard, so it is reachable either way.
export default function InfoTip({ text, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <span
      ref={wrap}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="What this means"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-gray-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full p-0.5"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-50 top-full mt-1.5 w-64 rounded-lg bg-gray-900 dark:bg-gray-700 text-gray-50 text-xs font-normal normal-case tracking-normal leading-relaxed px-3 py-2 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
