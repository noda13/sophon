import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RankingRow, StrategyId } from '../../../../shared/schema/stock';
import { type ListSearchRoute, useListSearch } from '../../../composables/useListSearch';
import { useDataTable } from '../../../composables/useDataTable';
import { type RankingFilter, filterRanking, hasActiveFilter, okuToYen, sectorOptions } from '../logic/filters';
import { rankingColumns } from './rankingColumns';
import { stockQueryOptions } from './stockQueries';
import {
  DEFAULT_STRATEGY,
  RANKING_PAGE_SIZE,
  type RankingSearch,
  rankingSearchSchema,
} from './rankingSearch';

const NO_ROWS: readonly RankingRow[] = [];

export function useRanking(route: ListSearchRoute<RankingSearch>) {
  const { search, setSearch, resetSearch } = useListSearch(route, rankingSearchSchema);
  const strategy: StrategyId = search.strategy ?? DEFAULT_STRATEGY;

  const strategiesQuery = useQuery(stockQueryOptions.strategies());
  const rankingQuery = useQuery(stockQueryOptions.ranking(strategy));

  const strategies = useMemo(() => strategiesQuery.data?.filter((s) => s.active) ?? [], [strategiesQuery.data]);
  const strategyMeta = strategiesQuery.data?.find((s) => s.id === strategy);

  const allRows = rankingQuery.data ?? NO_ROWS;
  const sectors = useMemo(() => sectorOptions(allRows), [allRows]);

  const filter = useMemo<RankingFilter>(
    () => ({
      minMarketCap: okuToYen(search.minCap),
      maxMarketCap: okuToYen(search.maxCap),
      excludeSectors: search.exclude,
    }),
    [search.minCap, search.maxCap, search.exclude],
  );
  const rows = useMemo(() => filterRanking(allRows, filter), [allRows, filter]);

  const table = useDataTable(rows, rankingColumns, { search, setSearch, defaultPageSize: RANKING_PAGE_SIZE });

  const setStrategy = useCallback(
    (id: StrategyId) => setSearch({ strategy: id === DEFAULT_STRATEGY ? undefined : id, page: undefined }),
    [setSearch],
  );
  const setMinCap = useCallback(
    (oku: number | undefined) => setSearch({ minCap: oku, page: undefined }),
    [setSearch],
  );
  const setMaxCap = useCallback(
    (oku: number | undefined) => setSearch({ maxCap: oku, page: undefined }),
    [setSearch],
  );
  const setExcludeSectors = useCallback(
    (sectorNames: string[]) => setSearch({ exclude: sectorNames.length > 0 ? sectorNames : undefined, page: undefined }),
    [setSearch],
  );
  const setQuery = useCallback(
    (q: string) => table.setGlobalFilter(q),
    [table],
  );
  const setPage = useCallback((page: number) => table.setPageIndex(page - 1), [table]);

  // 絞り込み条件だけを外す。戦略、並べ替え、検索語は残す
  const resetFilters = useCallback(
    () => setSearch({ minCap: undefined, maxCap: undefined, exclude: undefined, page: undefined }),
    [setSearch],
  );

  return {
    strategy,
    strategies,
    strategyMeta,
    setStrategy,
    isPending: rankingQuery.isPending,
    error: rankingQuery.error,
    snapshotAt: allRows[0]?.snapshotAt ?? null,
    sectors,
    minCap: search.minCap,
    maxCap: search.maxCap,
    excludeSectors: search.exclude ?? [],
    query: search.q ?? '',
    setMinCap,
    setMaxCap,
    setExcludeSectors,
    setQuery,
    hasFilter: hasActiveFilter(filter),
    resetFilters,
    resetSearch,
    table,
    sourceCount: allRows.length,
    matchedCount: table.getPrePaginatedRowModel().rows.length,
    page: search.page ?? 1,
    pageSize: search.pageSize ?? RANKING_PAGE_SIZE,
    setPage,
  };
}
