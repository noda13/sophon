import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Issue } from '../../../../shared/schema/issue';
import type { ListSearch } from '../../../composables/useListSearch';
import {
  type CategoryFilter,
  DEFAULT_ISSUE_SORT,
  type IssueSort,
  filterItems,
  findById,
  paginate,
  sortByKey,
} from '../logic/issues';
import type { IssuesSearch } from '../logic/search';
import { issuesQuery } from './queries';

export const ISSUES_PAGE_SIZE = 20;

export function useIssues({ search, setSearch, resetSearch }: ListSearch<IssuesSearch>) {
  const query = useQuery(issuesQuery);
  const { category, sourceType, page } = search;
  const sort = search.sort ?? DEFAULT_ISSUE_SORT;

  const filtered = useMemo(
    () => sortByKey(filterItems(query.data ?? [], { category, sourceType }), sort),
    [query.data, category, sourceType, sort],
  );
  const paged = useMemo(() => paginate(filtered, page, ISSUES_PAGE_SIZE), [filtered, page]);

  // 絞り込みや並びを変えると件数が変わるため、ページは先頭に戻す
  const setCategory = useCallback(
    (value: CategoryFilter | undefined) => setSearch({ category: value, page: undefined }),
    [setSearch],
  );
  const setSourceType = useCallback(
    (value: Issue['sourceType'] | undefined) => setSearch({ sourceType: value, page: undefined }),
    [setSearch],
  );
  const setSort = useCallback(
    (value: IssueSort) =>
      setSearch({ sort: value === DEFAULT_ISSUE_SORT ? undefined : value, page: undefined }),
    [setSearch],
  );
  const setPage = useCallback(
    (value: number) => setSearch({ page: value <= 1 ? undefined : value }),
    [setSearch],
  );

  return {
    items: paged.items,
    total: paged.total,
    page: paged.page,
    pageCount: paged.pageCount,
    pageSize: ISSUES_PAGE_SIZE,
    category,
    sourceType,
    sort,
    setCategory,
    setSourceType,
    setSort,
    setPage,
    reset: resetSearch,
    isPending: query.isPending,
    error: query.error,
  };
}

export function useIssue(id: string) {
  const query = useQuery(issuesQuery);
  const issue = useMemo(() => (query.data ? findById(query.data, id) : undefined), [query.data, id]);
  return {
    issue,
    isPending: query.isPending,
    error: query.error,
    notFound: query.isSuccess && issue === undefined,
  };
}
