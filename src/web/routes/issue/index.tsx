import { createFileRoute } from '@tanstack/react-router';
import { categorySummaryQuery, ideasQuery, issueMetaQuery, issuesQuery } from '../../features/issue/composables/queries';
import { IssuesSearchSchema } from '../../features/issue/logic/search';
import { IssueDashboardPage } from '../../features/issue/pages/IssueDashboardPage';

export const Route = createFileRoute('/issue/')({
  validateSearch: IssuesSearchSchema,
  // 失敗の表示は各 composable の error に任せるため、先読みは失敗しても遷移を止めない
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.prefetchQuery(issuesQuery),
      queryClient.prefetchQuery(ideasQuery),
      queryClient.prefetchQuery(categorySummaryQuery),
      queryClient.prefetchQuery(issueMetaQuery),
    ]);
  },
  component: () => <IssueDashboardPage route={Route} />,
});
