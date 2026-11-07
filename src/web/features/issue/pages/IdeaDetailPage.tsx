import { ErrorBox } from '../../../ui/ErrorBox';
import { Loading } from '../../../ui/Loading';
import { AppIdeaPanel } from '../components/AppIdeaPanel';
import { BackLink } from '../components/BackLink';
import { FreshnessNote } from '../components/FreshnessNote';
import { IssueOverview } from '../components/IssueOverview';
import { useIssueFreshness } from '../composables/useCategorySummary';
import { useIdea } from '../composables/useIdeas';

export function IdeaDetailPage({ id }: { id: string }) {
  const { idea, isPending, error, notFound } = useIdea(id);
  const freshness = useIssueFreshness();

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink to="/issue/ideas">アイデア一覧に戻る</BackLink>
      <FreshnessNote freshness={freshness} />

      {isPending && <Loading />}
      {error && <ErrorBox message="アイデアデータの取得に失敗しました" />}
      {notFound && <ErrorBox message="該当するアイデアが見つかりません" />}

      {idea && (
        <div className="space-y-6">
          <AppIdeaPanel issue={idea} headingLevel="h1" showScore />
          <section aria-labelledby="source-issue">
            <h2 id="source-issue" className="mb-3 text-base font-bold text-fg">
              元の社会課題
            </h2>
            <IssueOverview issue={idea} headingLevel="h2" />
          </section>
        </div>
      )}
    </div>
  );
}
