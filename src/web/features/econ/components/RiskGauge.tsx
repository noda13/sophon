import { safeHref } from '../../../ui/safeHref';
import type { NewsArticle, RiskAssessment } from '../../../../shared/schema/econ';
import type { CategoryImpact } from '../logic/profile';
import { categoryLabels, riskLevelConfig } from '../logic/riskColors';
import { DeltaBadge } from './DeltaBadge';

interface Props {
  risk: RiskAssessment;
  sourceNews: readonly NewsArticle[];
  impact?: CategoryImpact;
}

const IMPACT_BADGE = {
  high: { label: '高', className: 'bg-danger-muted text-danger' },
  medium: { label: '中', className: 'bg-warning-muted text-warning' },
  low: { label: '低', className: 'bg-success-muted text-success' },
} as const;

const MAX_TITLE_LENGTH = 60;

function truncate(title: string): string {
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH)}…` : title;
}

export function RiskGauge({ risk, sourceNews, impact }: Props) {
  const config = riskLevelConfig[risk.level] ?? riskLevelConfig.moderate!;
  const label = categoryLabels[risk.category] ?? risk.category;

  return (
    <article className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-fg">{label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${config.color}`}>{config.label}</span>
      </div>
      <div className={`mb-2 flex items-baseline text-3xl font-bold ${config.color}`}>
        {risk.score}
        <span className="ml-1 text-sm text-fg-subtle">/100</span>
        <DeltaBadge delta={risk.delta} className="ml-2" />
      </div>
      <p className="mb-2 line-clamp-2 text-sm text-fg-muted">{risk.summaryJa}</p>
      {risk.changeReasonJa && <p className="mb-2 text-xs italic text-fg-subtle">{risk.changeReasonJa}</p>}
      <ul className="mb-2 space-y-1">
        {risk.factorsJa.slice(0, 3).map((factor, i) => (
          <li key={`${i}-${factor}`} className="flex items-start gap-1 text-xs text-fg-subtle">
            <span className="mt-0.5">•</span>
            <span>{factor}</span>
          </li>
        ))}
      </ul>
      {sourceNews.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="mb-1 text-xs text-fg-subtle">根拠ニュース</p>
          <ul className="space-y-1">
            {sourceNews.map((article) => {
              const href = safeHref(article.originalUrl);
              const className = 'block truncate text-xs text-accent';
              return (
                <li key={article.id}>
                  {href === '#' ? (
                    <span className={className} title={article.originalTitle}>
                      {truncate(article.originalTitle)}
                    </span>
                  ) : (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${className} hover:underline`}
                      title={article.originalTitle}
                    >
                      {truncate(article.originalTitle)}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {impact && (
        <div className="mt-3 border-t border-border pt-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${IMPACT_BADGE[impact.impactLevel].className}`}>
            あなたへの影響: {IMPACT_BADGE[impact.impactLevel].label}
          </span>
        </div>
      )}
    </article>
  );
}
