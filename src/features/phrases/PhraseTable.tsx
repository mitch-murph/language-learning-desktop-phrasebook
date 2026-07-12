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

// Fixed per-column widths so toggling edit mode or hiding columns never
// changes column widths — only the cell contents change. Keyed by ColumnId
// so adding/renaming a column in columns.tsx without updating this map is
// a compile error rather than a silent fallback to the default width.
const COLUMN_WIDTHS: Record<ColumnId, number> = {
  languageName: 150,
  translation: 220,
  text: 220,
  transcription: 190,
  tags: 210,
  audio: 270,
  createdAt: 100,
  actions: 90,
};

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
      <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: 1350 }}>
        <colgroup>
          {table.getAllLeafColumns().map(col => (
            <col key={col.id} style={{ width: COLUMN_WIDTHS[col.id as ColumnId] ?? 150 }} />
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
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      disabled={!header.column.getCanSort()}
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex items-center gap-1 disabled:cursor-default"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: '▲', desc: '▼' }[header.column.getIsSorted() as string] ?? ''}
                    </button>
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
