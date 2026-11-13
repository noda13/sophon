import type { ListSearchRoute } from '../../../composables/useListSearch';
import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import { FreshnessBadge } from '../../../ui/FreshnessBadge';
import { Loading } from '../../../ui/Loading';
import { Pagination } from '../../../ui/Pagination';
import { Tabs } from '../../../ui/Tabs';
import { ArticleCard } from '../components/ArticleCard';
import { EolPanel } from '../components/EolPanel';
import { SearchBox } from '../components/SearchBox';
import { TechNav } from '../components/TechNav';
import { useArticles } from '../composables/useArticles';
import { useEol } from '../composables/useEol';
import { useTechFreshness } from '../composables/useTechFreshness';
import { CATEGORY_TAB_ITEMS } from '../logic/categories';
import type { ArticlesSearch } from '../search';

export function ArticlesPage({ route }: { route: ListSearchRoute<ArticlesSearch> }) {
  const list = useArticles(route);
  const eol = useEol();
  const freshness = useTechFreshness();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TechNav />
        {freshness && <FreshnessBadge {...freshness} />}
      </div>

      <div className="space-y-3">
        <Tabs
          items={CATEGORY_TAB_ITEMS}
          value={list.category}
          onChange={list.setCategory}
          ariaLabel="カテゴリ"
        />
        <SearchBox value={list.q} onChange={list.setQuery} />
      </div>

      {list.error ? (
        <ErrorBox message={list.error.message} />
      ) : list.isPending ? (
        <Loading />
      ) : list.articles.length === 0 ? (
        <EmptyState
          title="記事がありません"
          description={list.isFiltered ? '条件に合う記事がありません。絞り込みを変えてください' : 'データ収集後に表示されます'}
        />
      ) : (
        <>
          <p className="text-xs text-fg-subtle">{list.totalCount} 件</p>
          <div className="space-y-3">
            {list.articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination
            page={list.page}
            pageSize={list.pageSize}
            totalCount={list.totalCount}
            onPageChange={list.setPage}
          />
        </>
      )}

      {eol.error ? (
        <ErrorBox message={eol.error.message} />
      ) : (
        eol.data && eol.data.length > 0 && <EolPanel items={eol.data} />
      )}
    </div>
  );
}
