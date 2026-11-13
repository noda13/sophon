import { Link } from '@tanstack/react-router';
import type { SourceId } from '../../../../shared/schema/meta';
import { Card } from '../../../ui/Card';
import { FreshnessBadge } from '../../../ui/FreshnessBadge';
import { useSourceSummary } from '../composables/useSourceSummary';

interface SourceCardProps {
  source: SourceId;
  to: '/stock' | '/tech' | '/issue' | '/econ';
  description: string;
}

export function SourceCard({ source, to, description }: SourceCardProps) {
  const { freshness, items } = useSourceSummary(source);
  return (
    <Link to={to} className="block rounded-lg transition-colors hover:ring-1 hover:ring-border-strong">
      <Card title={source}>
        <p className="text-sm text-fg-muted">{description}</p>
        {items.length > 0 && (
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {items.map((item) => (
              <div key={item.label} className="flex gap-1">
                <dt className="text-fg-muted">{item.label}</dt>
                <dd className="font-medium text-fg">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {freshness && (
          <div className="mt-3">
            <FreshnessBadge {...freshness} />
          </div>
        )}
      </Card>
    </Link>
  );
}
