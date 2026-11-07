import { Link } from '@tanstack/react-router';
import type { Issue } from '../../../../shared/schema/issue';
import { ScoreBadge } from '../../../ui/ScoreBadge';
import { formatRelativeDate } from '../logic/format';
import { CategoryBadge, SourceTypeBadge } from './Badge';

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <article className="rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-border-strong">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CategoryBadge category={issue.category} />
        <SourceTypeBadge sourceType={issue.sourceType} />
      </div>

      <h3 className="mb-1 text-sm font-semibold leading-snug text-fg">
        <Link to="/issue/issues/$id" params={{ id: issue.id }} className="hover:text-accent hover:underline">
          {issue.originalTitle}
        </Link>
      </h3>

      {issue.summaryJa && <p className="mb-3 line-clamp-2 text-xs text-fg-muted">{issue.summaryJa}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <ScoreBadge label="深刻度" score={issue.severityScore} size="sm" />
        <ScoreBadge label="アプリ化" score={issue.appifiabilityScore} size="sm" higherIsBetter />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-fg-subtle">
        <span>{issue.source}</span>
        <span>{formatRelativeDate(issue.publishedAt)}</span>
      </div>
    </article>
  );
}
