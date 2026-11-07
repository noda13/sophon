import { ErrorBox } from '../../../ui/ErrorBox';
import { Loading } from '../../../ui/Loading';
import { AppIdeaPanel } from '../components/AppIdeaPanel';
import { BackLink } from '../components/BackLink';
import { FreshnessNote } from '../components/FreshnessNote';
import { IssueOverview } from '../components/IssueOverview';
import { useIssueFreshness } from '../composables/useCategorySummary';
import { useIssue } from '../composables/useIssues';

export function IssueDetailPage({ id }: { id: string }) {
  const { issue, isPending, error, notFound } = useIssue(id);
  const freshness = useIssueFreshness();

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink to="/issue">ダッシュボードに戻る</BackLink>
      <FreshnessNote freshness={freshness} />

      {isPending && <Loading />}
      {error && <ErrorBox message="課題データの取得に失敗しました" />}
      {notFound && <ErrorBox message="該当する課題が見つかりません" />}

      {issue && (
        <div className="space-y-6">
          <IssueOverview issue={issue} headingLevel="h1" />
          {issue.ideaGeneratedAt && issue.proposedAppIdea && <AppIdeaPanel issue={issue} headingLevel="h2" />}
        </div>
      )}
    </div>
  );
}
