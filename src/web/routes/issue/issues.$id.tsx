import { createFileRoute } from '@tanstack/react-router';
import { issueMetaQuery, issuesQuery } from '../../features/issue/composables/queries';
import { IssueDetailPage } from '../../features/issue/pages/IssueDetailPage';

export const Route = createFileRoute('/issue/issues/$id')({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([queryClient.prefetchQuery(issuesQuery), queryClient.prefetchQuery(issueMetaQuery)]);
  },
  component: function IssueDetailRoute() {
    const { id } = Route.useParams();
    return <IssueDetailPage id={id} />;
  },
});
