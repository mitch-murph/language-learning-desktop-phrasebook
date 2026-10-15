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
import { STUDY_COLUMN_IDS, type ColumnId, type StudyColumn } from './columns';
import PhraseCards from './PhraseCards';
import TableSettingsMenu from './TableSettingsMenu';
import { EyeIcon, LockIcon } from './icons';

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
  studyHidden: Record<StudyColumn, boolean>;
  onToggleStudyHidden: (col: StudyColumn) => void;
  onToggleEditMode: () => void;
  showHidden: boolean;
  onShowHiddenChange: (v: boolean) => void;
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
  actions: 8,
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
  studyHidden,
  onToggleStudyHidden,
  onToggleEditMode,
  showHidden,
  onShowHiddenChange,
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
      // Only a scroll container below the width where TABLE_MIN_WIDTH can overflow:
      // an overflow ancestor would stop the header sticking to the page scroll.
      // The header is likewise sticky only above that width (matching breakpoint) —
      // inside the scroll container a sticky `top` offset would shove the header
      // down over the rows instead of pinning it.
      <div className="rounded-lg border border-slate-200 max-[960px]:overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: TABLE_MIN_WIDTH }}>
          <colgroup>
            {visibleLeafColumns.map(col => {
              const weight = COLUMN_WEIGHTS[col.id as ColumnId] ?? 10;
              return <col key={col.id} style={{ width: `${(weight / totalWeight) * 100}%` }} />;
            })}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className={`group border-b min-[961px]:sticky min-[961px]:top-[var(--toolbar-h,0px)] min-[961px]:z-20 border-slate-200 py-2 text-xs font-semibold tracking-wide text-slate-500 ${
                      header.column.id === 'actions' ? 'px-1.5' : 'px-3'
                    } ${editMode ? 'bg-amber-50' : 'bg-slate-50'}`}
                  >
                    {header.isPlaceholder ? null : header.column.id === 'actions' ? (
                      <ActionsHeader
                        editMode={editMode}
                        onToggleEditMode={onToggleEditMode}
                        columnVisibility={columnVisibility}
                        onColumnVisibilityChange={onColumnVisibilityChange}
                        showHidden={showHidden}
                        onShowHiddenChange={onShowHiddenChange}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        {header.column.getCanSort() ? (
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
                        {/* Sibling of the sort button, never nested in it (invalid HTML,
                            and the nested click would also toggle the sort). */}
                        {isStudyColumn(header.column.id) && (
                          <QuizHideButton
                            hidden={studyHidden[header.column.id]}
                            onClick={() => onToggleStudyHidden(header.column.id as StudyColumn)}
                          />
                        )}
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

function isStudyColumn(id: string): id is StudyColumn {
  return (STUDY_COLUMN_IDS as readonly string[]).includes(id);
}

interface ActionsHeaderProps {
  editMode: boolean;
  onToggleEditMode: () => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (v: VisibilityState) => void;
  showHidden: boolean;
  onShowHiddenChange: (v: boolean) => void;
}

// Table-level controls in the Actions column header: the edit lock, and the
// gear (column visibility + show hidden).
function ActionsHeader({
  editMode,
  onToggleEditMode,
  columnVisibility,
  onColumnVisibilityChange,
  showHidden,
  onShowHiddenChange,
}: ActionsHeaderProps) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        onClick={onToggleEditMode}
        aria-pressed={editMode}
        aria-label={editMode ? 'Lock editing' : 'Allow editing'}
        title={editMode ? 'Editing unlocked — click to lock' : 'Locked — click to allow editing'}
        className={`rounded p-1 hover:bg-slate-200 ${editMode ? 'text-amber-600' : 'text-slate-400'}`}
      >
        <LockIcon unlocked={editMode} />
      </button>
      <TableSettingsMenu
        columnVisibility={columnVisibility}
        onChange={onColumnVisibilityChange}
        showHidden={showHidden}
        onShowHiddenChange={onShowHiddenChange}
      />
    </div>
  );
}

// Eye icon in a quiz column's header: toggles hiding that column for
// self-testing. Faint until the header is hovered/focused, but always shown
// (and emphasized) while the column is hidden so the state is visible at a
// glance. Opacity-only, so it never shifts the header layout.
function QuizHideButton({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={hidden}
      title={hidden ? 'Hidden for quiz — click to show' : 'Hide for quiz'}
      className={`rounded p-0.5 transition-opacity hover:bg-slate-200 focus-visible:opacity-100 ${
        hidden ? 'text-blue-600 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100'
      }`}
    >
      <EyeIcon crossed={hidden} />
    </button>
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
