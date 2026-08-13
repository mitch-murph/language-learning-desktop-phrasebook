import { useEffect, useRef, useState } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { COLUMN_LABELS, TOGGLEABLE_COLUMN_IDS } from './columns';

interface Props {
  columnVisibility: VisibilityState;
  onChange: (v: VisibilityState) => void;
}

export default function ColumnsMenu({ columnVisibility, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  function toggle(id: string) {
    onChange({ ...columnVisibility, [id]: columnVisibility[id] === false });
  }

  const hiddenCount = TOGGLEABLE_COLUMN_IDS.filter(id => columnVisibility[id] === false).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-36 truncate whitespace-nowrap rounded-md border border-slate-300 px-2 py-1.5 text-left text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      >
        {hiddenCount === 0 ? 'All columns' : `${hiddenCount} column${hiddenCount === 1 ? '' : 's'} hidden`}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
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
        </div>
      )}
    </div>
  );
}
