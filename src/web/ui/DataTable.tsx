import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface DataTableHeader {
  id: string;
  label: ReactNode;
  align?: 'left' | 'right';
  sortDirection?: SortDirection | false;
  onSort?: () => void;
}

export interface DataTableRow {
  id: string;
  cells: ReactNode[];
  onClick?: () => void;
}

interface DataTableProps {
  headers: readonly DataTableHeader[];
  rows: readonly DataTableRow[];
  caption?: string;
  emptyMessage?: string;
}

const SORT_MARK: Record<SortDirection, string> = { asc: '▲', desc: '▼' };
const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

export function DataTable({ headers, rows, caption, emptyMessage = '該当するデータがありません' }: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-raised text-fg-muted">
          <tr>
            {headers.map((h) => {
              const dir = h.sortDirection || undefined;
              return (
                <th
                  key={h.id}
                  scope="col"
                  aria-sort={dir ? ARIA_SORT[dir] : undefined}
                  className={`px-3 py-2 font-medium whitespace-nowrap ${h.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {h.onSort ? (
                    <button type="button" onClick={h.onSort} className="inline-flex items-center gap-1 hover:text-fg">
                      {h.label}
                      <span aria-hidden="true" className="text-xs">
                        {dir ? SORT_MARK[dir] : ''}
                      </span>
                    </button>
                  ) : (
                    h.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-fg-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={row.onClick}
                className={`border-t border-border ${row.onClick ? 'cursor-pointer hover:bg-surface-raised' : ''}`}
              >
                {row.cells.map((cell, i) => (
                  <td
                    key={headers[i]?.id ?? i}
                    className={`px-3 py-2 ${headers[i]?.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
