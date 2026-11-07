import { createFileRoute } from '@tanstack/react-router';
import { AnyMetaSchema } from '../../../shared/schema/meta';
import { DigestIndexSchema, DigestSchema } from '../../../shared/schema/tech';
import { sourceQueryOptions } from '../../composables/useSourceQuery';
import { DIGEST_INDEX_FILE, DIGEST_LATEST_FILE } from '../../features/tech/composables/useDigest';
import { DigestPage } from '../../features/tech/pages/DigestPage';
import { digestSearchSchema } from '../../features/tech/search';

export const Route = createFileRoute('/tech/digest')({
  validateSearch: digestSearchSchema,
  loaderDeps: ({ search }) => ({ date: search.date }),
  // 日付指定のときは、最新日かどうかが索引を読むまで分からないので、ダイジェスト本体は先読みしない
  loader: async ({ context: { queryClient }, deps }) => {
    await Promise.all([
      queryClient.prefetchQuery(sourceQueryOptions('tech', DIGEST_INDEX_FILE, DigestIndexSchema)),
      queryClient.prefetchQuery(sourceQueryOptions('tech', 'meta.json', AnyMetaSchema)),
      deps.date === undefined
        ? queryClient.prefetchQuery(sourceQueryOptions('tech', DIGEST_LATEST_FILE, DigestSchema))
        : undefined,
    ]);
  },
  component: () => <DigestPage route={Route} />,
});
