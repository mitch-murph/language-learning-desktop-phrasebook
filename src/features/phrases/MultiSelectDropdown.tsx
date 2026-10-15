import { useRef, useState } from 'react';
import { useClickOutside } from './useClickOutside';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export default function MultiSelectDropdown({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside([ref], open, () => setOpen(false));

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
    <div ref={ref} className="relative min-w-0 flex-1 sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full truncate sm:w-36 whitespace-nowrap rounded-md border border-slate-300 px-2 py-1.5 text-left text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      >
        {summary}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white shadow-md">
          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">No options</p>}
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
          {/* Always rendered (hidden when nothing selected) so it never shifts the options. */}
          <button
            type="button"
            onClick={() => onChange([])}
            className={`block w-full border-t border-slate-200 px-2 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-slate-100 ${
              selected.length > 0 ? '' : 'invisible pointer-events-none'
            }`}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
