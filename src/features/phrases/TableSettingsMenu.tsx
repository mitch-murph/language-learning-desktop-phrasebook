import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VisibilityState } from '@tanstack/react-table';
import { COLUMN_LABELS, TOGGLEABLE_COLUMN_IDS } from './columns';
import { useClickOutside } from './useClickOutside';
import { GearIcon } from './icons';

interface Props {
  columnVisibility: VisibilityState;
  onChange: (v: VisibilityState) => void;
  showHidden: boolean;
  onShowHiddenChange: (v: boolean) => void;
}

const MENU_WIDTH = 224;

// Gear icon for the table header: column visibility plus show-hidden. The menu is portaled to <body> and
// positioned with fixed coordinates: the table wrapper can be an
// overflow-x-auto scroll container, which would clip an absolutely positioned
// menu rendered inside it.
export default function TableSettingsMenu({ columnVisibility, onChange, showHidden, onShowHiddenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside([buttonRef, menuRef], open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Scroll events are captured from every element, so ignore the ones from
    // scrolling inside the menu itself — only page/table scroll should close it.
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      // Right-align the menu to the gear, clamped inside the viewport.
      const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
      setPos({ top: r.bottom + 4, left });
    }
    setOpen(v => !v);
  }

  function toggle(id: string) {
    onChange({ ...columnVisibility, [id]: columnVisibility[id] === false });
  }

  const hiddenCount = TOGGLEABLE_COLUMN_IDS.filter(id => columnVisibility[id] === false).length;
  // Tint the gear when the table is showing something other than the defaults.
  const customized = hiddenCount > 0 || !showHidden;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Columns and display options"
        title={hiddenCount === 0 ? 'Columns & display' : `Columns & display (${hiddenCount} hidden)`}
        className={`relative rounded p-1 hover:bg-slate-200 ${customized ? 'text-blue-600' : 'text-slate-400'}`}
      >
        <GearIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-md"
          >
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => onChange({})}
                className="block w-full px-2 py-1 text-left text-xs font-medium text-blue-600 hover:bg-slate-100"
              >
                Show all
              </button>
            )}
            {TOGGLEABLE_COLUMN_IDS.map(id => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
              >
                <input
                  type="checkbox"
                  checked={columnVisibility[id] !== false}
                  onChange={() => toggle(id)}
                  className="shrink-0"
                />
                <span className="truncate">{COLUMN_LABELS[id]}</span>
              </label>
            ))}
            <label className="mt-1 flex cursor-pointer items-center gap-2 border-t border-slate-200 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={e => onShowHiddenChange(e.target.checked)}
                className="shrink-0"
              />
              <span className="truncate">Show hidden phrases</span>
            </label>
          </div>,
          document.body,
        )}
    </>
  );
}
