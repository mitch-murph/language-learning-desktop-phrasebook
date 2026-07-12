import type { StudyColumn } from './columns';

const STUDY_COLUMNS: { key: StudyColumn; label: string }[] = [
  { key: 'translation', label: 'Translation' },
  { key: 'text', label: 'Phrase' },
  { key: 'transcription', label: 'Romanization' },
];

interface Props {
  editMode: boolean;
  onToggleEditMode: () => void;
  hidden: Record<StudyColumn, boolean>;
  onToggleHidden: (col: StudyColumn) => void;
  onResetReveals: () => void;
  anyHidden: boolean;
}

export default function StudyBar({ editMode, onToggleEditMode, hidden, onToggleHidden, onResetReveals, anyHidden }: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <label className="flex cursor-pointer items-center gap-2 select-none">
        <span className="text-slate-600">Allow editing</span>
        <span className="relative inline-flex h-5 w-9 shrink-0">
          <input
            type="checkbox"
            checked={editMode}
            onChange={onToggleEditMode}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600" />
          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </span>
      </label>

      <div className="flex items-center gap-3 text-slate-600">
        <span className="text-slate-500">Hide columns:</span>
        {STUDY_COLUMNS.map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={hidden[key]}
              onChange={() => onToggleHidden(key)}
              className="h-3.5 w-3.5"
            />
            {label}
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={onResetReveals}
        className={`ml-auto rounded-md px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 ${
          anyHidden ? '' : 'invisible pointer-events-none'
        }`}
      >
        Hide revealed cells again
      </button>
    </div>
  );
}
