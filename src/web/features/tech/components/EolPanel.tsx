import type { EolItem } from '../../../../shared/schema/tech';
import { Card } from '../../../ui/Card';
import { EmptyState } from '../../../ui/EmptyState';
import { type EolTone, eolStatus, formatEolDate } from '../logic/eol';

const CARD_TONE: Record<EolTone, string> = {
  unknown: 'border-border bg-surface-raised',
  expired: 'border-border bg-surface-raised',
  critical: 'border-danger/40 bg-danger-muted',
  warning: 'border-warning/40 bg-warning-muted',
  safe: 'border-success/30 bg-success-muted',
};

const BADGE_TONE: Record<EolTone, string> = {
  unknown: 'border-border text-fg-muted',
  expired: 'border-border text-fg-subtle',
  critical: 'border-danger/40 text-danger',
  warning: 'border-warning/40 text-warning',
  safe: 'border-success/40 text-success',
};

export function EolPanel({ items }: { items: readonly EolItem[] }) {
  return (
    <Card title="EOL / サポート期限">
      {items.length === 0 ? (
        <EmptyState title="EOL 情報がありません" />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {items.map((item) => {
            const { tone, label } = eolStatus(item.daysLeft);
            return (
              <li
                key={`${item.product}-${item.cycle}`}
                className={`rounded-lg border px-4 py-3 ${CARD_TONE[tone]}`}
              >
                <div className="truncate text-sm font-semibold text-fg">{item.product}</div>
                <div className="mb-2 text-xs text-fg-muted">
                  {item.cycle}
                  {item.latest && <span className="ml-1 text-fg-subtle">({item.latest})</span>}
                </div>
                <div className="mb-2 text-xs text-fg-subtle">EOL: {formatEolDate(item.eol)}</div>
                <span className={`rounded border px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}>{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
