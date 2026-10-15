import { useEffect, useRef } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';
import PlaySplitButton from './PlaySplitButton';
import MobileSettingsMenu from './MobileSettingsMenu';
import { QUEUE_MODE_LABEL, QUEUE_MODES, type QueueMode } from './useQueuePlayer';
import type { StudyColumn } from './columns';

const PLAY_MODES = QUEUE_MODES.map(value => ({ value, label: QUEUE_MODE_LABEL[value] }));

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
  editMode: boolean;
  onToggleEditMode: () => void;
  studyHidden: Record<StudyColumn, boolean>;
  onToggleStudyHidden: (col: StudyColumn) => void;
  onResetReveals: () => void;
  anyStudyHidden: boolean;
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
  editMode,
  onToggleEditMode,
  studyHidden,
  onToggleStudyHidden,
  onResetReveals,
  anyStudyHidden,
}: Props) {
  // The table header sticks just below the sticky toolbar, whose height varies
  // with wrapping — publish it as a CSS variable the header offsets by.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--toolbar-h', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    // Sticky (sm and up) so filter + play/export stay reachable while scrolling a
    // long list. -mx-6/px-6 mirrors App's gutter so the backdrop spans the full
    // width. z-30 keeps it, and its dropdown menus, above table content. Not
    // sticky on phones, where two wrapped rows would eat the viewport.
    <div ref={rootRef} className="-mx-4 mb-4 flex flex-col gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:sticky sm:top-0 sm:z-30 sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search phrase, romanization, translation…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 sm:min-w-[260px]"
        />
        <MobileSettingsMenu
          showHidden={showHidden}
          onShowHiddenChange={onShowHiddenChange}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
          studyHidden={studyHidden}
          onToggleStudyHidden={onToggleStudyHidden}
          onResetReveals={onResetReveals}
          anyStudyHidden={anyStudyHidden}
        />
        {/* Phones: languages + tags share their own full-width line below
            search, splitting it equally; `sm:contents` flattens it on desktop. */}
        <div className="flex basis-full gap-3 sm:contents">
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
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PlaySplitButton
          label={`▶ Play${selectedCount > 0 ? ` ${selectedCount} selected` : ` all ${count}`}`}
          disabled={count === 0}
          onPlay={onPlay}
          mode={playMode}
          modes={PLAY_MODES}
          onModeChange={onPlayModeChange}
          shuffle={shuffle}
          onShuffleChange={onShuffleChange}
        />
        <button
          type="button"
          onClick={onExport}
          disabled={count === 0}
          className="min-w-0 flex-1 whitespace-nowrap rounded-md bg-slate-800 px-3 py-1.5 text-center text-sm font-medium tabular-nums text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[170px] sm:flex-none"
        >
          Export{selectedCount > 0 ? ` ${selectedCount} selected` : ` all ${count}`}
        </button>
        <button
          type="button"
          onClick={onClearSelection}
          className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 ${
            selectedCount > 0 ? '' : 'invisible pointer-events-none max-sm:hidden'
          }`}
        >
          Clear {selectedCount} selected
        </button>

        {/* Desktop only (phones have this in the settings menu). Always
            rendered, invisible when nothing is hidden — avoids layout shift. */}
        <button
          type="button"
          onClick={onResetReveals}
          className={`ml-auto hidden whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:block ${
            anyStudyHidden ? '' : 'invisible pointer-events-none'
          }`}
        >
          Hide revealed cells again
        </button>
      </div>
    </div>
  );
}
