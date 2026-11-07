import type { Issue } from '../../../../shared/schema/issue';
import { ScoreBadge } from '../../../ui/ScoreBadge';
import { safeHref } from '../../../ui/safeHref';
import { formatRelativeDate } from '../logic/format';
import { Badge, CategoryBadge, SourceTypeBadge } from './Badge';

interface IssueOverviewProps {
  issue: Issue;
  // 詳細ページの主見出しにするか、他の節の中の小見出しにするか
  headingLevel: 'h1' | 'h2';
}

export function IssueOverview({ issue, headingLevel: Heading }: IssueOverviewProps) {
  const href = safeHref(issue.originalUrl);
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={issue.category} />
        <SourceTypeBadge sourceType={issue.sourceType} />
        <Badge>{issue.source}</Badge>
      </div>

      <Heading className="mb-4 text-xl font-bold leading-snug text-fg">{issue.originalTitle}</Heading>

      <div className="mb-4 flex flex-wrap gap-3">
        <ScoreBadge label="深刻度" score={issue.severityScore} />
        <ScoreBadge label="緊急度" score={issue.urgencyScore} />
        <ScoreBadge label="アプリ化スコア" score={issue.appifiabilityScore} higherIsBetter />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-fg-muted">
        <span>公開: {formatRelativeDate(issue.publishedAt)}</span>
        {href !== '#' && (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            元記事を見る →
          </a>
        )}
      </div>

      {issue.summaryJa && (
        <div className="rounded-md bg-surface-overlay p-4">
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">要約</h3>
          <p className="text-sm leading-relaxed text-fg">{issue.summaryJa}</p>
        </div>
      )}

      {issue.affectedDomain.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">影響領域</h3>
          <ul className="flex flex-wrap gap-2">
            {issue.affectedDomain.map((domain) => (
              <li key={domain}>
                <Badge tone="info">{domain}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
