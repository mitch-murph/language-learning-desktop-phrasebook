import MultiSelectDropdown from './MultiSelectDropdown';
import type { QueueMode } from './useQueuePlayer';

const PLAY_MODES: { value: QueueMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'slow', label: 'Slow' },
  { value: 'fast', label: 'Fast' },
  { value: 'drill', label: 'Drill' },
  { value: 'fastDrill', label: 'Fast Drill' },
  { value: 'recall', label: 'Recall' },
  { value: 'recallDrill', label: 'Recall Drill' },
  { value: 'reverseRecall', label: 'Reverse Recall' },
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  selectedLanguages: string[];
  onLanguagesChange: (v: string[]) => void;
  languageOptions: string[];
  selectedTags: string[];
  onTagsChange: (v: string[]) => void;
  tagOptions: string[];
  showHidden: boolean;
  onShowHiddenChange: (v: boolean) => void;
  count: number;
  selectedCount: number;
  onClearSelection: () => void;
  onExport: () => void;
  playMode: QueueMode;
  onPlayModeChange: (m: QueueMode) => void;
  shuffle: boolean;
  onShuffleChange: (v: boolean) => void;
  onPlay: () => void;
}

export default function Toolbar({
  search,
  onSearchChange,
  selectedLanguages,
  onLanguagesChange,
  languageOptions,
  selectedTags,
  onTagsChange,
  tagOptions,
  showHidden,
  onShowHiddenChange,
  count,
  selectedCount,
  onClearSelection,
  onExport,
  playMode,
  onPlayModeChange,
  shuffle,
  onShuffleChange,
  onPlay,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search phrase, romanization, translation…"
        className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
      <MultiSelectDropdown
        label="languages"
        options={languageOptions}
        selected={selectedLanguages}
        onChange={onLanguagesChange}
      />
      <MultiSelectDropdown
        label="tags"
        options={tagOptions}
        selected={selectedTags}
        onChange={onTagsChange}
      />
      <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
        <input type="checkbox" checked={showHidden} onChange={e => onShowHiddenChange(e.target.checked)} />
        Show hidden
      </label>
      <button
        type="button"
        onClick={onClearSelection}
        className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 ${
          selectedCount > 0 ? '' : 'invisible pointer-events-none'
        }`}
      >
        Clear {selectedCount} selected
      </button>
      <select
        value={playMode}
        onChange={e => onPlayModeChange(e.target.value as QueueMode)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      >
        {PLAY_MODES.map(m => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
        <input type="checkbox" checked={shuffle} onChange={e => onShuffleChange(e.target.checked)} />
        Shuffle
      </label>
      <button
        type="button"
        onClick={onPlay}
        disabled={count === 0}
        className="min-w-[150px] whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-center text-sm font-medium tabular-nums text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ▶ Play{selectedCount > 0 ? ` ${selectedCount} selected` : ` all ${count}`}
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={count === 0}
        className="min-w-[170px] whitespace-nowrap rounded-md bg-slate-800 px-3 py-1.5 text-center text-sm font-medium tabular-nums text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Export{selectedCount > 0 ? ` ${selectedCount} selected` : ` all ${count}`}
      </button>
    </div>
  );
}
