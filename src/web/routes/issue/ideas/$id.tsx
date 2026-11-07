import { createFileRoute } from '@tanstack/react-router';
import { ideasQuery, issueMetaQuery } from '../../../features/issue/composables/queries';
import { IdeaDetailPage } from '../../../features/issue/pages/IdeaDetailPage';

export const Route = createFileRoute('/issue/ideas/$id')({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([queryClient.prefetchQuery(ideasQuery), queryClient.prefetchQuery(issueMetaQuery)]);
  },
  component: function IdeaDetailRoute() {
    const { id } = Route.useParams();
    return <IdeaDetailPage id={id} />;
  },
});
