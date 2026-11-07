import type { ListSearchRoute } from '../../../composables/useListSearch';
import { useListSearch } from '../../../composables/useListSearch';
import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import { FreshnessBadge } from '../../../ui/FreshnessBadge';
import { Loading } from '../../../ui/Loading';
import { DateNav } from '../components/DateNav';
import { DigestView } from '../components/DigestView';
import { TechNav } from '../components/TechNav';
import { useDigest } from '../composables/useDigest';
import { useTechFreshness } from '../composables/useTechFreshness';
import { type DigestSearch, digestSearchSchema } from '../search';

export function DigestPage({ route }: { route: ListSearchRoute<DigestSearch> }) {
  const { search, setSearch } = useListSearch(route, digestSearchSchema);
  const view = useDigest(search.date);
  const freshness = useTechFreshness();
  const { digest } = view;
  const isEmpty = digest !== undefined && !digest.overviewJa && digest.sections.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TechNav />
        {freshness.generatedAt && (
          <FreshnessBadge
            generatedAt={freshness.generatedAt.toISOString()}
            isStale={freshness.isStale}
            health={freshness.health === 'unknown' ? 'ok' : freshness.health}
          />
        )}
      </div>

      <DateNav
        date={view.date}
        prevDate={view.prevDate}
        nextDate={view.nextDate}
        onSelect={(date) => setSearch({ date })}
      />

      {view.error ? (
        <ErrorBox message={view.error.message} />
      ) : view.isPending ? (
        <Loading />
      ) : view.isMissing || isEmpty || !digest ? (
        <EmptyState
          title="この日のダイジェストがありません"
          description={view.date ? `${view.date} のダイジェストはまだ生成されていません` : undefined}
        />
      ) : (
        <DigestView digest={digest} />
      )}
    </div>
  );
}
