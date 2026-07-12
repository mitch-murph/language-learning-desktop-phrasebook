import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { Phrase } from '../../api/client';
import type { ColumnId } from './columns';

interface Props {
  data: Phrase[];
  columns: ColumnDef<Phrase, any>[];
}

// Proportional per-column widths (sum to 100%) so toggling edit mode or
// hiding columns never changes column widths — only the cell contents
// change — and the table fills its container exactly instead of forcing
// horizontal scroll at every width. Keyed by ColumnId so adding/renaming a
// column in columns.tsx without updating this map is a compile error rather
// than a silent fallback to the default width. TABLE_MIN_WIDTH is a floor
// below which columns would be squeezed unreadably thin; narrower windows
// scroll horizontally instead.
const COLUMN_WIDTHS: Record<ColumnId, string> = {
  select: '3%',
  languageName: '11%',
  translation: '16%',
  text: '16%',
  transcription: '14%',
  tags: '15%',
  audio: '12%',
  createdAt: '7%',
  actions: '6%',
};
const TABLE_MIN_WIDTH = 900;

export default function PhraseTable({ data, columns }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: row => row.phraseId,
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: TABLE_MIN_WIDTH }}>
        <colgroup>
          {table.getAllLeafColumns().map(col => (
            <col key={col.id} style={{ width: COLUMN_WIDTHS[col.id as ColumnId] ?? '10%' }} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
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
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  className={`h-12 px-3 py-1.5 align-middle ${
                    cell.column.id === 'tags' ? '' : 'overflow-hidden'
                  }`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-400">
                No phrases match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
