import { createFileRoute } from '@tanstack/react-router';
import { ideasQuery, issueMetaQuery } from '../../../features/issue/composables/queries';
import { IdeasSearchSchema } from '../../../features/issue/logic/search';
import { IdeasPage } from '../../../features/issue/pages/IdeasPage';

export const Route = createFileRoute('/issue/ideas/')({
  validateSearch: IdeasSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([queryClient.prefetchQuery(ideasQuery), queryClient.prefetchQuery(issueMetaQuery)]);
  },
  component: () => <IdeasPage route={Route} />,
});
