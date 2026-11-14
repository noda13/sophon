import { FreshnessBadge, type FreshnessBadgeProps } from '../../../ui/FreshnessBadge';

export function FreshnessNote({ freshness }: { freshness: FreshnessBadgeProps | null }) {
  if (!freshness) return null;
  return (
    <div className="mb-4 flex justify-end">
      <FreshnessBadge {...freshness} />
    </div>
  );
}
