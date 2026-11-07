import { createColumnHelper } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type DataTableFeatures, type TableSearch, useDataTable } from './useDataTable';

interface Row {
  name: string;
  score: number;
}

const helper = createColumnHelper<DataTableFeatures, Row>();
const columns = helper.columns([
  helper.accessor('name', { header: 'Name' }),
  helper.accessor('score', { header: 'Score' }),
]);

const rows: Row[] = [
  { name: 'alpha', score: 3 },
  { name: 'bravo', score: 1 },
  { name: 'charlie', score: 2 },
  { name: 'alpine', score: 5 },
  { name: 'delta', score: 4 },
];

function useHarness(initial: TableSearch, defaultPageSize = 2) {
  const [search, setState] = useState<TableSearch>(initial);
  const calls: Partial<TableSearch>[] = [];
  const setSearch = (partial: Partial<TableSearch>) => {
    calls.push(partial);
    setState((prev) => ({ ...prev, ...partial }));
  };
  const table = useDataTable(rows, columns, { search, setSearch, defaultPageSize });
  return { table, search, calls };
}

const names = (table: ReturnType<typeof useHarness>['table']) =>
  table.getRowModel().rows.map((r) => r.original.name);

describe('useDataTable', () => {
  it('search の page と pageSize で表示範囲が決まる（page は 1 始まり）', () => {
    const { result } = renderHook(() => useHarness({ page: 2 }));
    expect(names(result.current.table)).toEqual(['charlie', 'alpine']);
    expect(result.current.table.getPageCount()).toBe(3);
  });

  it('search の sort と desc で並べ替える', () => {
    const { result } = renderHook(() => useHarness({ sort: 'score', desc: true, pageSize: 10 }));
    expect(names(result.current.table)).toEqual(['alpine', 'delta', 'alpha', 'charlie', 'bravo']);
  });

  it('search の q で絞り込む', () => {
    const { result } = renderHook(() => useHarness({ q: 'alp', pageSize: 10 }));
    expect(names(result.current.table)).toEqual(['alpha', 'alpine']);
  });

  it('ページ送りは page を更新し、1 ページ目は URL に出さない', () => {
    const { result } = renderHook(() => useHarness({}));
    act(() => result.current.table.nextPage());
    expect(result.current.search.page).toBe(2);
    act(() => result.current.table.firstPage());
    expect(result.current.search.page).toBeUndefined();
  });

  it('並べ替えを切り替えると page を 1 に戻す', () => {
    const { result } = renderHook(() => useHarness({ page: 3 }));
    act(() => result.current.table.getColumn('score')?.toggleSorting(false));
    expect(result.current.search).toMatchObject({ sort: 'score', page: undefined });
    expect(result.current.search.desc).toBeUndefined();

    act(() => result.current.table.getColumn('score')?.toggleSorting(true));
    expect(result.current.search).toMatchObject({ sort: 'score', desc: true });
  });

  it('絞り込みを変えると page を 1 に戻し、空文字は q を消す', () => {
    const { result } = renderHook(() => useHarness({ page: 3 }));
    act(() => result.current.table.setGlobalFilter('al'));
    expect(result.current.search).toMatchObject({ q: 'al', page: undefined });

    act(() => result.current.table.setGlobalFilter(''));
    expect(result.current.search.q).toBeUndefined();
  });

  it('pageSize を変えると page を 1 に戻し、既定値なら URL に出さない', () => {
    const { result } = renderHook(() => useHarness({ page: 3 }));
    act(() => result.current.table.setPageSize(3));
    expect(result.current.search).toMatchObject({ pageSize: 3, page: undefined });

    act(() => result.current.table.setPageSize(2));
    expect(result.current.search.pageSize).toBeUndefined();
  });

  it('rows が変わっても page は自動でリセットされない', () => {
    const setSearch = vi.fn();
    const { rerender } = renderHook(
      ({ data }: { data: Row[] }) => useDataTable(data, columns, { search: { page: 2 }, setSearch, defaultPageSize: 2 }),
      { initialProps: { data: rows } },
    );
    rerender({ data: [...rows] });
    expect(setSearch).not.toHaveBeenCalled();
  });
});
