import { useRef, useState } from 'react';
import type { StudyColumn } from './columns';
import { useClickOutside } from './useClickOutside';
import { GearIcon } from './icons';

const STUDY_COLUMN_LABELS: { key: StudyColumn; label: string }[] = [
  { key: 'translation', label: 'Translation' },
  { key: 'text', label: 'Phrase' },
  { key: 'transcription', label: 'Romanization' },
];

interface Props {
  showHidden: boolean;
  onShowHiddenChange: (v: boolean) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  studyHidden: Record<StudyColumn, boolean>;
  onToggleStudyHidden: (col: StudyColumn) => void;
  onResetReveals: () => void;
  anyStudyHidden: boolean;
}

// Phone-only counterpart of the table-header gear + lock (cards have no
// header): show-hidden, edit lock, and per-column quiz hiding in one menu.
// The gear is amber while editing is unlocked, blue when anything else
// differs from the defaults.
export default function MobileSettingsMenu({
  showHidden,
  onShowHiddenChange,
  editMode,
  onToggleEditMode,
  studyHidden,
  onToggleStudyHidden,
  onResetReveals,
  anyStudyHidden,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside([ref], open, () => setOpen(false));

  const customized = !showHidden || anyStudyHidden || Object.values(studyHidden).some(Boolean);
  const tint = editMode ? 'text-amber-600' : customized ? 'text-blue-600' : 'text-slate-500';

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings"
        className={`rounded-md border px-2 py-1.5 ${
          editMode ? 'border-amber-300 bg-amber-50' : 'border-slate-300'
        } ${tint}`}
      >
        <GearIcon size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-md">
          <label className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50">
            Allow editing
            <span className="relative inline-flex h-5 w-9 shrink-0">
              <input type="checkbox" checked={editMode} onChange={onToggleEditMode} className="peer sr-only" />
              <span className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600" />
              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
            <input type="checkbox" checked={showHidden} onChange={e => onShowHiddenChange(e.target.checked)} />
            Show hidden phrases
          </label>
          <div className="mt-1 border-t border-slate-200 px-3 pb-1 pt-2 text-xs font-medium text-slate-400">
            Hide for quiz
          </div>
          {STUDY_COLUMN_LABELS.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
              <input type="checkbox" checked={studyHidden[key]} onChange={() => onToggleStudyHidden(key)} />
              {label}
            </label>
          ))}
          <button
            type="button"
            onClick={() => {
              onResetReveals();
              setOpen(false);
            }}
            disabled={!anyStudyHidden}
            className="block w-full border-t border-slate-200 px-3 py-2 text-left text-xs font-medium text-blue-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Hide revealed cells again
          </button>
        </div>
      )}
    </div>
  );
}
