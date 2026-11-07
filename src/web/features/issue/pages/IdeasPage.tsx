import { useListSearch, type ListSearchRoute } from '../../../composables/useListSearch';
import { Card } from '../../../ui/Card';
import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import { Loading } from '../../../ui/Loading';
import { Pagination } from '../../../ui/Pagination';
import { CategorySelect, DifficultyTabs, SortSelect } from '../components/FilterBar';
import { FreshnessNote } from '../components/FreshnessNote';
import { IdeaCard } from '../components/IdeaCard';
import { useIssueFreshness } from '../composables/useCategorySummary';
import { useIdeas } from '../composables/useIdeas';
import { IdeasSearchSchema, type IdeasSearch } from '../logic/search';

export function IdeasPage({ route }: { route: ListSearchRoute<IdeasSearch> }) {
  const list = useIdeas(useListSearch(route, IdeasSearchSchema));
  const freshness = useIssueFreshness();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">アプリ化アイデア一覧</h1>
        <p className="mt-1 text-sm text-fg-muted">社会課題を解決するアプリのアイデアを一覧表示しています</p>
      </div>
      <FreshnessNote freshness={freshness} />

      <Card>
        <DifficultyTabs value={list.difficulty} onChange={list.setDifficulty} />
        <div className="flex flex-wrap items-end gap-3">
          <CategorySelect value={list.category} onChange={list.setCategory} />
          <SortSelect value={list.sort} onChange={list.setSort} />
          <p className="ml-auto text-sm text-fg-muted" aria-live="polite">
            {list.total} 件のアイデア
          </p>
        </div>
      </Card>

      {list.isPending && <Loading />}
      {list.error && <ErrorBox message="アイデアデータの取得に失敗しました" />}
      {!list.isPending && !list.error && list.items.length === 0 && <EmptyState title="該当するアイデアがありません" />}
      {list.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.items.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
      <Pagination page={list.page} pageSize={list.pageSize} totalCount={list.total} onPageChange={list.setPage} />
    </div>
  );
}
