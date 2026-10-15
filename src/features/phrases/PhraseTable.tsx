import { memo, useState, useSyncExternalStore } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import type { Phrase } from '../../api/client';
import type { ColumnId } from './columns';
import PhraseCards from './PhraseCards';

interface Props {
  data: Phrase[];
  columns: ColumnDef<Phrase, any>[];
  playingRowId?: string | null;
  editMode: boolean;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (v: VisibilityState) => void;
  // Strings that change exactly when something a row's cells depend on
  // changes, so unchanged rows can skip rendering. `globalSignature` covers
  // state shared by all rows; `rowSignature` covers per-row state.
  globalSignature: string;
  rowSignature: (phraseId: string) => string;
}

// Relative column-width weights (not percentages) so hiding a column via the
// Columns menu lets the remaining visible columns expand to fill the freed
// space instead of leaving dead space or forcing scroll. Widths are
// recomputed below as each column's weight over the sum of *visible*
// columns' weights. Keyed by ColumnId so adding/renaming a column in
// columns.tsx without updating this map is a compile error rather than a
// silent fallback to the default weight. TABLE_MIN_WIDTH is a floor below
// which columns would be squeezed unreadably thin; narrower windows scroll
// horizontally instead.
const COLUMN_WEIGHTS: Record<ColumnId, number> = {
  select: 3,
  languageName: 10,
  translation: 15,
  text: 15,
  transcription: 13,
  tags: 14,
  audio: 11,
  createdAt: 7,
  hide: 6,
  actions: 6,
};
const TABLE_MIN_WIDTH = 900;

// Matches Tailwind's `sm` breakpoint. Only one of table/cards is mounted at a
// time (rather than both with CSS hiding one) so rows aren't rendered twice.
const WIDE_QUERY = '(min-width: 640px)';
function subscribeWide(cb: () => void) {
  const m = window.matchMedia(WIDE_QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}
function getWide() {
  return window.matchMedia(WIDE_QUERY).matches;
}

export default function PhraseTable({
  data,
  columns,
  playingRowId,
  editMode,
  columnVisibility,
  onColumnVisibilityChange,
  globalSignature,
  rowSignature,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const isWide = useSyncExternalStore(subscribeWide, getWide);
  const globalSig = `${globalSignature}|${JSON.stringify(columnVisibility)}`;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: updater =>
      onColumnVisibilityChange(updater instanceof Function ? updater(columnVisibility) : updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: row => row.phraseId,
  });

  const rows = table.getRowModel().rows;
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWeight = visibleLeafColumns.reduce(
    (sum, col) => sum + (COLUMN_WEIGHTS[col.id as ColumnId] ?? 10),
    0,
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
        No phrases match your filters.
      </div>
    );
  }

  if (isWide) {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: TABLE_MIN_WIDTH }}>
          <colgroup>
            {visibleLeafColumns.map(col => {
              const weight = COLUMN_WEIGHTS[col.id as ColumnId] ?? 10;
              return <col key={col.id} style={{ width: `${(weight / totalWeight) * 100}%` }} />;
            })}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-500"
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: '▲', desc: '▼' }[header.column.getIsSorted() as string] ?? ''}
                      </button>
                    ) : (
                      // Non-sortable columns (e.g. the select checkbox) render without a
                      // wrapping button — a checkbox nested inside a button is invalid
                      // HTML and silently swallows its own click/change events.
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map(row => (
              <PhraseRow
                key={row.id}
                row={row}
                isPlaying={row.original.phraseId === playingRowId}
                sig={`${globalSig}#${rowSignature(row.original.phraseId)}`}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <PhraseCards
      rows={rows}
      playingRowId={playingRowId}
      editMode={editMode}
      globalSig={globalSig}
      rowSignature={rowSignature}
    />
  );
}

interface PhraseRowProps {
  row: Row<Phrase>;
  isPlaying: boolean;
  sig: string;
}

// Skips re-rendering unless this row's own phrase, playing state, or the
// signature of the state its cells close over (selection, reveal, playing
// pace, edit/study mode, column visibility, tag list) changed. Without this,
// every checkbox toggle or playback tick re-rendered every cell in the table.
const PhraseRow = memo(
  function PhraseRow({ row, isPlaying }: PhraseRowProps) {
    return (
      <tr
        className={`border-b border-slate-100 last:border-0 ${
          isPlaying ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-slate-50/60'
        }`}
      >
        {row.getVisibleCells().map(cell => (
          <td
            key={cell.id}
            className={`h-12 px-3 py-1.5 align-middle ${cell.column.id === 'tags' ? '' : 'overflow-hidden'}`}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  },
  (a, b) => a.row.original === b.row.original && a.isPlaying === b.isPlaying && a.sig === b.sig,
);
