import { memo } from 'react';
import { flexRender, type Row } from '@tanstack/react-table';
import type { Phrase } from '../../api/client';
import type { ColumnId } from './columns';

interface Props {
  rows: Row<Phrase>[];
  playingRowId?: string | null;
  editMode: boolean;
  globalSig: string;
  rowSignature: (phraseId: string) => string;
}

// Uses getAllCells(), not getVisibleCells() — the desktop Columns menu
// (which drives table column visibility) addresses horizontal table width,
// a problem the stacked card layout doesn't have, so cards always show every
// field regardless of what's hidden in the table.
function renderCell(row: Row<Phrase>, id: ColumnId) {
  const cell = row.getAllCells().find(c => c.column.id === id)!;
  return flexRender(cell.column.columnDef.cell, cell.getContext());
}

interface CardProps {
  row: Row<Phrase>;
  isPlaying: boolean;
  editMode: boolean;
  sig: string;
}

// Same memoization contract as PhraseTable's PhraseRow: re-render only when
// the phrase, playing state, or the state signature its cells depend on changes.
const PhraseCard = memo(
  function PhraseCard({ row, isPlaying, editMode }: CardProps) {
    const phrase = row.original;
    const hasTags = (phrase.tags?.length ?? 0) > 0;
    // In edit mode the "hide" cell is the checkbox that controls visibility
    // (and "actions" is the Delete button) — both must stay visible. Outside
    // edit mode "hide" is a read-only "Visible"/"Hidden" badge and "actions"
    // is empty, so showing the row is only worth the space when it says
    // something other than the default (visible) state.
    const showVisibilityRow = editMode || (phrase.hide ?? false);
    return (
      <div className={`rounded-lg border p-3 ${isPlaying ? 'border-blue-200 bg-blue-50' : editMode ? 'border-amber-300' : 'border-slate-200'}`}>
        <div className="mb-1.5 flex items-center gap-2">
          {renderCell(row, 'select')}
          <div className="min-w-0 flex-1">{renderCell(row, 'languageName')}</div>
          {renderCell(row, 'createdAt')}
        </div>

        <div className="flex flex-col gap-1">
          {renderCell(row, 'translation')}
          {renderCell(row, 'text')}
          {/* Only shown for non-Latin-script languages — matches the table's
              behavior of hiding the whole field rather than a "—" placeholder,
              which just wastes space in a card with no fixed row height. */}
          {phrase.nonLatin && renderCell(row, 'transcription')}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {renderCell(row, 'audio')}
          {hasTags && renderCell(row, 'tags')}
        </div>

        {showVisibilityRow && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {renderCell(row, 'hide')}
            {renderCell(row, 'actions')}
          </div>
        )}
      </div>
    );
  },
  (a, b) => a.row.original === b.row.original && a.isPlaying === b.isPlaying && a.sig === b.sig,
);

export default function PhraseCards({ rows, playingRowId, editMode, globalSig, rowSignature }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map(row => (
        <PhraseCard
          key={row.id}
          row={row}
          isPlaying={row.original.phraseId === playingRowId}
          editMode={editMode}
          sig={`${globalSig}#${rowSignature(row.original.phraseId)}`}
        />
      ))}
    </div>
  );
}
