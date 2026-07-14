import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export default function MultiSelectDropdown({ label, options, selected, onChange }: Props) {
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

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  }

  const summary =
    selected.length === 0
      ? `All ${label}`
      : selected.length === 1
        ? selected[0]
        : `${selected.length} ${label}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-36 truncate whitespace-nowrap rounded-md border border-slate-300 px-2 py-1.5 text-left text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      >
        {summary}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
          {options.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">No options</p>}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="block w-full px-2 py-1 text-left text-xs font-medium text-blue-600 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
          {options.map(opt => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleValue(opt)}
                className="shrink-0"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
