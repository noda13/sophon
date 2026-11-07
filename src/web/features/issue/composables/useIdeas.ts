import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Issue } from '../../../../shared/schema/issue';
import type { ListSearch } from '../../../composables/useListSearch';
import {
  type CategoryFilter,
  DEFAULT_IDEA_SORT,
  type IssueSort,
  filterItems,
  findById,
  paginate,
  sortByKey,
  topIdeas,
} from '../logic/issues';
import type { IdeasSearch } from '../logic/search';
import { ideasQuery } from './queries';

export const IDEAS_PAGE_SIZE = 12;
export const TOP_IDEAS_LIMIT = 6;

export function useIdeas({ search, setSearch, resetSearch }: ListSearch<IdeasSearch>) {
  const query = useQuery(ideasQuery);
  const { category, difficulty, page } = search;
  const sort = search.sort ?? DEFAULT_IDEA_SORT;

  const filtered = useMemo(
    () => sortByKey(filterItems(query.data ?? [], { category, difficulty }), sort),
    [query.data, category, difficulty, sort],
  );
  const paged = useMemo(() => paginate(filtered, page, IDEAS_PAGE_SIZE), [filtered, page]);

  const setCategory = useCallback(
    (value: CategoryFilter | undefined) => setSearch({ category: value, page: undefined }),
    [setSearch],
  );
  const setDifficulty = useCallback(
    (value: Exclude<Issue['difficulty'], ''> | undefined) => setSearch({ difficulty: value, page: undefined }),
    [setSearch],
  );
  const setSort = useCallback(
    (value: IssueSort) =>
      setSearch({ sort: value === DEFAULT_IDEA_SORT ? undefined : value, page: undefined }),
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
    pageSize: IDEAS_PAGE_SIZE,
    category,
    difficulty,
    sort,
    setCategory,
    setDifficulty,
    setSort,
    setPage,
    reset: resetSearch,
    isPending: query.isPending,
    error: query.error,
  };
}

export function useIdea(id: string) {
  const query = useQuery(ideasQuery);
  const idea = useMemo(() => (query.data ? findById(query.data, id) : undefined), [query.data, id]);
  return {
    idea,
    isPending: query.isPending,
    error: query.error,
    notFound: query.isSuccess && idea === undefined,
  };
}

export function useTopIdeas(limit = TOP_IDEAS_LIMIT) {
  const query = useQuery(ideasQuery);
  const ideas = useMemo(() => (query.data ? topIdeas(query.data, limit) : []), [query.data, limit]);
  return { ideas, isPending: query.isPending, error: query.error };
}
