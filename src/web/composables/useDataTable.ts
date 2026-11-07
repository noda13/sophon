import {
  type ColumnDef,
  type PaginationState,
  type RowData,
  type SortingState,
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

// URL 上のページは 1 始まり、table の pageIndex は 0 始まり。既定値は URL に出さないため optional にしている
export const tableSearchSchema = z.object({
  q: z.string().optional(),
  sort: z.string().optional(),
  desc: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});
export type TableSearch = z.infer<typeof tableSearchSchema>;

export interface DataTableOptions {
  search: TableSearch;
  setSearch: (partial: Partial<TableSearch>) => void;
  defaultPageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
});

// createColumnHelper<DataTableFeatures, Row>() に渡して列を定義する
export type DataTableFeatures = typeof features;
// 列ごとに値の型が違うため、TanStack Table 自身の columnHelper.columns と同じく TValue は any にする
export type DataTableColumns<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>[];

export function useDataTable<TData extends RowData>(
  rows: readonly TData[],
  columns: DataTableColumns<TData>,
  { search, setSearch, defaultPageSize = DEFAULT_PAGE_SIZE }: DataTableOptions,
) {
  const sorting = useMemo<SortingState>(
    () => (search.sort ? [{ id: search.sort, desc: search.desc ?? false }] : []),
    [search.sort, search.desc],
  );
  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: (search.page ?? 1) - 1, pageSize: search.pageSize ?? defaultPageSize }),
    [search.page, search.pageSize, defaultPageSize],
  );

  const onSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      // 並べ替えを変えたら 1 ページ目に戻す
      setSearch({ sort: first?.id, desc: first?.desc || undefined, page: undefined });
    },
    [sorting, setSearch],
  );
  const onPaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      const sizeChanged = next.pageSize !== pagination.pageSize;
      setSearch({
        page: sizeChanged || next.pageIndex === 0 ? undefined : next.pageIndex + 1,
        pageSize: next.pageSize === defaultPageSize ? undefined : next.pageSize,
      });
    },
    [pagination, defaultPageSize, setSearch],
  );
  const onGlobalFilterChange = useCallback(
    (updater: unknown) => {
      const next = typeof updater === 'function' ? updater(search.q ?? '') : updater;
      setSearch({ q: typeof next === 'string' && next !== '' ? next : undefined, page: undefined });
    },
    [search.q, setSearch],
  );

  const data = rows as TData[];
  return useTable({
    features,
    columns,
    data,
    state: { sorting, pagination, globalFilter: search.q ?? '' },
    onSortingChange,
    onPaginationChange,
    onGlobalFilterChange,
    // ページはすべて URL が持つので、データ変更に伴う table 内部の自動リセットは切る
    autoResetPageIndex: false,
    globalFilterFn: 'includesString',
  });
}
