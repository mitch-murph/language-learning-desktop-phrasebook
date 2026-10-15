import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import type { Phrase, PhrasePatch } from '../../api/client';
import { colorForName } from '../../domain/languages';
import EditableText from './EditableText';
import TagsEditor from './TagsEditor';
import PlayButton from './PlayButton';
import { RefreshIcon, TrashIcon } from './icons';

const columnHelper = createColumnHelper<Phrase>();

export type StudyColumn = 'text' | 'transcription' | 'translation';
export const STUDY_COLUMN_IDS: readonly StudyColumn[] = ['translation', 'text', 'transcription'];

// Kept as a single source of truth for column ids so PhraseTable's fixed
// column widths are checked against this list at compile time.
export const COLUMN_IDS = [
  'select',
  'languageName',
  'translation',
  'text',
  'transcription',
  'tags',
  'audio',
  'createdAt',
  'hide',
  'actions',
] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];

// Columns a user can toggle off via the Columns menu. `select` is excluded —
// it's the mechanism selection depends on — and `actions`, whose header hosts
// the Columns gear and edit lock themselves; both always stay visible.
export const TOGGLEABLE_COLUMN_IDS = COLUMN_IDS.filter(id => id !== 'select' && id !== 'actions');

export const COLUMN_LABELS: Record<ColumnId, string> = {
  select: '',
  languageName: 'Language',
  translation: 'Translation',
  text: 'Phrase',
  transcription: 'Romanization',
  tags: 'Tags',
  audio: 'Audio',
  createdAt: 'Saved',
  hide: 'Visibility',
  actions: 'Actions',
};

function RevealButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-200 hover:text-slate-600"
    >
      Reveal
    </button>
  );
}

interface ColumnOptions {
  playingKey: string | null;
  onPlay: (phraseId: string, pace: 'normal' | 'slow', s3Key: string) => void;
  onPatch: (phraseId: string, fields: PhrasePatch) => void;
  onDelete: (phraseId: string) => void;
  onRegenerate: (phrase: Phrase, text: string) => void;
  regenerating: Set<string>;
  allTags: string[];
  editMode: boolean;
  hidden: Record<StudyColumn, boolean>;
  isRevealed: (phraseId: string, column: StudyColumn) => boolean;
  onReveal: (phraseId: string, column: StudyColumn) => void;
  selected: Set<string>;
  onToggleSelect: (phraseId: string) => void;
  allVisibleSelected: boolean;
  onToggleSelectAllVisible: () => void;
}

function studyCell(
  column: StudyColumn,
  phraseId: string,
  hidden: Record<StudyColumn, boolean>,
  isRevealed: (phraseId: string, column: StudyColumn) => boolean,
  onReveal: (phraseId: string, column: StudyColumn) => void,
  content: React.ReactNode,
): React.ReactNode {
  if (!hidden[column]) return content;
  if (isRevealed(phraseId, column)) return content;
  return <RevealButton onClick={() => onReveal(phraseId, column)} />;
}

export function buildColumns({
  playingKey,
  onPlay,
  onPatch,
  onDelete,
  onRegenerate,
  regenerating,
  allTags,
  editMode,
  hidden,
  isRevealed,
  onReveal,
  selected,
  onToggleSelect,
  allVisibleSelected,
  onToggleSelectAllVisible,
}: ColumnOptions): ColumnDef<Phrase, any>[] {
  return [
    columnHelper.display({
      id: 'select',
      enableSorting: false,
      header: () => (
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={onToggleSelectAllVisible}
          aria-label="Select all visible phrases"
        />
      ),
      cell: info => (
        <input
          type="checkbox"
          className="max-sm:h-5 max-sm:w-5"
          checked={selected.has(info.row.original.phraseId)}
          onChange={() => onToggleSelect(info.row.original.phraseId)}
          aria-label={`Select ${info.row.original.text}`}
        />
      ),
    }),
    columnHelper.accessor('languageName', {
      header: 'Language',
      cell: info => (
        <span
          className="flex items-center gap-1.5 truncate text-sm font-medium"
          style={{ color: colorForName(info.getValue()) }}
          title={info.getValue()}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: colorForName(info.getValue()) }}
          />
          <span className="truncate">{info.getValue()}</span>
        </span>
      ),
    }),
    columnHelper.accessor('translation', {
      header: 'Translation',
      cell: info => {
        const row = info.row.original;
        const content = editMode ? (
          <EditableText
            value={info.getValue() ?? ''}
            placeholder="add translation"
            onCommit={v => onPatch(row.phraseId, { translation: v })}
          />
        ) : (
          <span className="block truncate text-sm text-slate-500" title={info.getValue() || undefined}>
            {info.getValue() || <span className="text-slate-300">—</span>}
          </span>
        );
        return studyCell('translation', row.phraseId, hidden, isRevealed, onReveal, content);
      },
    }),
    columnHelper.accessor('text', {
      header: 'Phrase',
      cell: info => {
        const row = info.row.original;
        // Text is immutable server-side, so committing a change regenerates the
        // audio and saves a new record (see PhrasesPage.regenerate).
        const content = editMode ? (
          <EditableText
            value={info.getValue()}
            placeholder="phrase"
            disabled={regenerating.has(row.phraseId)}
            onCommit={v => {
              if (v.trim()) onRegenerate(row, v.trim());
            }}
          />
        ) : (
          <span className="block truncate text-sm font-medium text-slate-800" title={info.getValue()}>
            {info.getValue()}
          </span>
        );
        return studyCell('text', row.phraseId, hidden, isRevealed, onReveal, content);
      },
    }),
    columnHelper.accessor('transcription', {
      header: 'Romanization',
      cell: info => {
        const row = info.row.original;
        if (!row.nonLatin) return <span className="text-xs text-slate-300">—</span>;
        const content = editMode ? (
          <EditableText
            value={info.getValue() ?? ''}
            placeholder="add romanization"
            italic
            onCommit={v => onPatch(row.phraseId, { transcription: v })}
          />
        ) : (
          <span className="block truncate text-sm italic text-slate-500" title={info.getValue() || undefined}>
            {info.getValue() || '—'}
          </span>
        );
        return studyCell('transcription', row.phraseId, hidden, isRevealed, onReveal, content);
      },
    }),
    // Untagged phrases map to undefined so `sortUndefined: 'last'` keeps them at
    // the bottom in both directions. Sorting compares the alphabetized tag list.
    columnHelper.accessor(row => (row.tags?.length ? row.tags : undefined), {
      id: 'tags',
      header: 'Tags',
      sortUndefined: 'last',
      sortingFn: (a, b, columnId) => {
        const key = (r: typeof a) =>
          [...((r.getValue(columnId) as string[] | undefined) ?? [])]
            .map(t => t.toLowerCase())
            .sort()
            .join(',');
        return key(a).localeCompare(key(b));
      },
      cell: info => {
        const row = info.row.original;
        const tags = info.getValue() ?? [];
        if (!editMode) {
          if (tags.length === 0) return <span className="text-xs text-slate-300">—</span>;
          return (
            <div className="flex flex-nowrap gap-1 overflow-hidden" title={tags.join(', ')}>
              {tags.map((t: string) => (
                <span
                  key={t}
                  className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  {t}
                </span>
              ))}
            </div>
          );
        }
        return (
          <TagsEditor tags={tags} suggestions={allTags} onChange={next => onPatch(row.phraseId, { tags: next })} />
        );
      },
    }),
    columnHelper.display({
      id: 'audio',
      enableSorting: false,
      header: 'Audio',
      cell: info => {
        const row = info.row.original;
        return (
          <div className="flex items-center gap-1">
            <PlayButton
              label="Normal"
              active={playingKey === `${row.phraseId}:normal`}
              onClick={() => onPlay(row.phraseId, 'normal', row.normalS3Key)}
            />
            <PlayButton
              label="Slow"
              active={playingKey === `${row.phraseId}:slow`}
              onClick={() => onPlay(row.phraseId, 'slow', row.slowS3Key)}
            />
          </div>
        );
      },
    }),
    columnHelper.accessor('createdAt', {
      header: 'Saved',
      cell: info => (
        <span className="whitespace-nowrap text-xs text-slate-400">
          {new Date(info.getValue()).toLocaleDateString()}
        </span>
      ),
    }),
    columnHelper.accessor('hide', {
      id: 'hide',
      header: 'Visibility',
      enableSorting: false,
      cell: info => {
        const row = info.row.original;
        const isHidden = info.getValue() ?? false;
        if (!editMode) {
          return isHidden ? (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Hidden</span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
              Visible
            </span>
          );
        }
        return (
          <input
            type="checkbox"
            checked={isHidden}
            onChange={() => onPatch(row.phraseId, { hide: !isHidden })}
            aria-label={`Hide ${row.text}`}
          />
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      enableSorting: false,
      header: '',
      cell: info => {
        if (!editMode) return null;
        const row = info.row.original;
        const busy = regenerating.has(row.phraseId);
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onMouseDown={e => e.preventDefault()}
              onClick={() => onRegenerate(row, row.text)}
              title={busy ? 'Regenerating audio…' : 'Regenerate audio'}
              aria-label="Regenerate audio"
              className="rounded p-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              <span className={busy ? 'inline-flex animate-spin' : 'inline-flex'}>
                <RefreshIcon />
              </span>
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                if (window.confirm(`Delete "${row.text}"?`)) onDelete(row.phraseId);
              }}
              title="Delete phrase"
              aria-label="Delete phrase"
              className="rounded p-1.5 text-red-600 hover:bg-red-50"
            >
              <TrashIcon />
            </button>
          </div>
        );
      },
    }),
  ];
}
