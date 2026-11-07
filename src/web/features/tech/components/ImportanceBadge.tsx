import type { Article } from '../../../../shared/schema/tech';

const TONE: Record<Article['importance'], string> = {
  高: 'border-danger/40 bg-danger-muted text-danger',
  中: 'border-warning/40 bg-warning-muted text-warning',
  低: 'border-border bg-surface-overlay text-fg-muted',
};

export function ImportanceBadge({ importance }: { importance: Article['importance'] }) {
  return (
    <span
      aria-label={`重要度 ${importance}`}
      className={`rounded border px-1.5 py-0.5 text-xs font-medium ${TONE[importance]}`}
    >
      {importance}
    </span>
  );
}
