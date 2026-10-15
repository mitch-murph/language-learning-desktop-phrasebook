import { useRef, useState } from 'react';
import { useClickOutside } from './useClickOutside';
import type { QueueMode } from './useQueuePlayer';

interface Props {
  label: string;
  disabled: boolean;
  onPlay: () => void;
  mode: QueueMode;
  modes: { value: QueueMode; label: string }[];
  onModeChange: (m: QueueMode) => void;
  shuffle: boolean;
  onShuffleChange: (v: boolean) => void;
}

// Split button: the left half starts the queue; the right half shows the
// current mode (and a shuffle marker) and opens a menu to change either, so
// the toolbar doesn't need a separate mode select + shuffle checkbox.
export default function PlaySplitButton({
  label,
  disabled,
  onPlay,
  mode,
  modes,
  onModeChange,
  shuffle,
  onShuffleChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside([ref], open, () => setOpen(false));

  const modeLabel = modes.find(m => m.value === mode)?.label ?? mode;

  return (
    <div ref={ref} className="relative flex basis-full sm:basis-auto">
      <button
        type="button"
        onClick={onPlay}
        disabled={disabled}
        className="flex-1 whitespace-nowrap rounded-l-md bg-emerald-600 px-3 py-1.5 text-center text-sm font-medium tabular-nums text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[150px] sm:flex-none"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Playback mode and shuffle"
        className="flex min-w-[8.5rem] items-center justify-between gap-1.5 whitespace-nowrap rounded-r-md border-l border-emerald-700 bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        <span className="truncate">
          {shuffle ? '⤮ ' : ''}
          {modeLabel}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-md">
          {modes.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                onModeChange(m.value);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${
                m.value === mode ? 'font-semibold text-blue-600' : 'text-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
          <label className="mt-1 flex cursor-pointer items-center gap-2 border-t border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
            <input type="checkbox" checked={shuffle} onChange={e => onShuffleChange(e.target.checked)} />
            Shuffle
          </label>
        </div>
      )}
    </div>
  );
}
