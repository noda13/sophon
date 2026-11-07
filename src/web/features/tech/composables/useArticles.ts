import { useCallback, useMemo } from 'react';
import type { TechCategory } from '../../../../shared/schema/tech';
import { ArticlesFileSchema } from '../../../../shared/schema/tech';
import { type ListSearchRoute, useListSearch } from '../../../composables/useListSearch';
import { useSourceQuery } from '../../../composables/useSourceQuery';
import { filterArticles, paginate } from '../logic/articles';
import { ALL_CATEGORIES, type CategoryFilter, isCategoryFilter } from '../logic/categories';
import { type ArticlesSearch, articlesSearchSchema } from '../search';

export const ARTICLES_PAGE_SIZE = 20;

export function useArticles(route: ListSearchRoute<ArticlesSearch>) {
  const { search, setSearch, resetSearch } = useListSearch(route, articlesSearchSchema);
  const query = useSourceQuery('tech', 'articles.json', ArticlesFileSchema);

  const filtered = useMemo(
    () => filterArticles(query.data ?? [], { category: search.category, q: search.q }),
    [query.data, search.category, search.q],
  );
  const page = useMemo(() => paginate(filtered, search.page ?? 1, ARTICLES_PAGE_SIZE), [filtered, search.page]);

  // 絞り込みを変えたら 1 ページ目に戻す
  const setCategory = useCallback(
    (value: string) => {
      const category: TechCategory | undefined =
        isCategoryFilter(value) && value !== ALL_CATEGORIES ? value : undefined;
      setSearch({ category, page: undefined });
    },
    [setSearch],
  );
  const setQuery = useCallback(
    (q: string) => setSearch({ q: q === '' ? undefined : q, page: undefined }),
    [setSearch],
  );
  const setPage = useCallback((next: number) => setSearch({ page: next === 1 ? undefined : next }), [setSearch]);

  const category: CategoryFilter = search.category ?? ALL_CATEGORIES;
  return {
    category,
    q: search.q ?? '',
    articles: page.items,
    page: page.page,
    pageSize: ARTICLES_PAGE_SIZE,
    totalCount: page.totalCount,
    isFiltered: search.category !== undefined || (search.q ?? '') !== '',
    isPending: query.isPending,
    error: query.error,
    setCategory,
    setQuery,
    setPage,
    resetFilters: resetSearch,
  };
}
