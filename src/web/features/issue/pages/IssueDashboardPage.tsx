import { useListSearch, type ListSearchRoute } from '../../../composables/useListSearch';
import { ErrorBox } from '../../../ui/ErrorBox';
import { Loading } from '../../../ui/Loading';
import { CategoryHeatmap } from '../components/CategoryHeatmap';
import { FreshnessNote } from '../components/FreshnessNote';
import { IssueFeed } from '../components/IssueFeed';
import { TopIdeasPanel } from '../components/TopIdeasPanel';
import { useCategorySummary, useIssueFreshness } from '../composables/useCategorySummary';
import { useTopIdeas } from '../composables/useIdeas';
import { useIssues } from '../composables/useIssues';
import { IssuesSearchSchema, type IssuesSearch } from '../logic/search';

export function IssueDashboardPage({ route }: { route: ListSearchRoute<IssuesSearch> }) {
  const feed = useIssues(useListSearch(route, IssuesSearchSchema));
  const heatmap = useCategorySummary();
  const topIdeas = useTopIdeas();
  const freshness = useIssueFreshness();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">社会課題ダッシュボード</h1>
        <p className="mt-1 text-sm text-fg-muted">ニュースから拾った社会課題と、アプリ化のアイデアを一覧します</p>
      </div>
      <FreshnessNote freshness={freshness} />

      {heatmap.isPending && <Loading />}
      {heatmap.error && <ErrorBox message="カテゴリデータの取得に失敗しました" />}
      {heatmap.hasData && (
        <CategoryHeatmap cells={heatmap.cells} selected={feed.category} onSelect={feed.setCategory} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IssueFeed feed={feed} />
        </div>
        <div>
          <TopIdeasPanel ideas={topIdeas.ideas} isPending={topIdeas.isPending} error={topIdeas.error} />
        </div>
      </div>
    </div>
  );
}
