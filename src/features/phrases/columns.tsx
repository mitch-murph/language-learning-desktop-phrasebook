import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import type { Phrase } from '../../api/client';
import { colorForName } from '../../domain/languages';
import EditableText from './EditableText';
import TagsEditor from './TagsEditor';
import PlayButton from './PlayButton';

const columnHelper = createColumnHelper<Phrase>();

export type StudyColumn = 'text' | 'transcription' | 'translation';

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
  onPatch: (phraseId: string, fields: { transcription?: string; translation?: string; tags?: string[] }) => void;
  onDelete: (phraseId: string) => void;
  allTags: string[];
  editMode: boolean;
  hidden: Record<StudyColumn, boolean>;
  isRevealed: (phraseId: string, column: StudyColumn) => boolean;
  onReveal: (phraseId: string, column: StudyColumn) => void;
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
  allTags,
  editMode,
  hidden,
  isRevealed,
  onReveal,
}: ColumnOptions): ColumnDef<Phrase, any>[] {
  return [
    columnHelper.accessor('languageName', {
      header: 'Language',
      cell: info => (
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium"
          style={{ color: colorForName(info.getValue()) }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorForName(info.getValue()) }} />
          {info.getValue()}
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
          <span className="block truncate text-sm" title={info.getValue() || undefined}>
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
        const content = (
          <span className="block truncate text-sm" title={info.getValue()}>
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
    columnHelper.accessor('tags', {
      header: 'Tags',
      enableSorting: false,
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
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: info => {
        if (!editMode) return null;
        return (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${info.row.original.text}"?`)) onDelete(info.row.original.phraseId);
            }}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        );
      },
    }),
  ];
}
