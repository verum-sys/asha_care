import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n';

export interface BarAction { key: string; label: string; onClick: () => void }

/** A "More" button with a small menu of secondary actions. Closes on Escape or a tap outside. */
export function MoreMenu({ actions, placement = 'top' }: { actions: BarAction[]; placement?: 'top' | 'bottom' }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);
  if (actions.length === 0) return null;
  return (
    <div ref={root} className="relative">
      <button type="button" className="btn btn-secondary !min-h-[48px]" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">⋯</span>
        {t('case.more')}
      </button>
      {open && (
        <ul role="menu" className={`absolute right-0 z-30 w-64 max-w-[calc(100vw-2rem)] space-y-1 rounded-2xl border border-line bg-white p-2 shadow-xl ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {actions.map(action => (
            <li key={action.key} role="none">
              <button type="button" role="menuitem" className="btn btn-secondary btn-block !min-h-[44px] !justify-start text-sm" onClick={() => { setOpen(false); action.onClick(); }}>
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
