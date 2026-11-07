import { createFileRoute } from '@tanstack/react-router';
import { AnyMetaSchema } from '../../../shared/schema/meta';
import { ArticlesFileSchema, EolFileSchema } from '../../../shared/schema/tech';
import { sourceQueryOptions } from '../../composables/useSourceQuery';
import { ArticlesPage } from '../../features/tech/pages/ArticlesPage';
import { articlesSearchSchema } from '../../features/tech/search';

export const Route = createFileRoute('/tech/')({
  validateSearch: articlesSearchSchema,
  // prefetchQuery は失敗しても throw しない。エラーはページ側の ErrorBox が出す
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.prefetchQuery(sourceQueryOptions('tech', 'articles.json', ArticlesFileSchema)),
      queryClient.prefetchQuery(sourceQueryOptions('tech', 'eol.json', EolFileSchema)),
      queryClient.prefetchQuery(sourceQueryOptions('tech', 'meta.json', AnyMetaSchema)),
    ]);
  },
  component: () => <ArticlesPage route={Route} />,
});
