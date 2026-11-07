import type { Freshness } from '../../../composables/useFreshness';
import { FreshnessBadge } from '../../../ui/FreshnessBadge';

// health が unknown のときは警告を出さず、更新時刻だけを見せる
export function FreshnessNote({ freshness }: { freshness: Freshness }) {
  if (!freshness.generatedAt) return null;
  return (
    <div className="mb-4 flex justify-end">
      <FreshnessBadge
        generatedAt={freshness.generatedAt.toISOString()}
        isStale={freshness.isStale}
        health={freshness.health === 'unknown' ? 'ok' : freshness.health}
      />
    </div>
  );
}
