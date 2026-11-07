import { Link } from 'react-router-dom';
import type { Issue } from '../../lib/types';
import { CATEGORY_LABELS, CATEGORY_COLORS, type IssueCategoryType } from '../../lib/categories';
import { formatDate } from '../../lib/formatters';
import ScoreBadge from '../common/ScoreBadge';

interface IssueCardProps {
  issue: Issue;
}

const SOURCE_TYPE_LABELS: Record<Issue['sourceType'], string> = {
  twitter: 'Twitter',
  news_jp: '国内ニュース',
  news_global: '海外ニュース',
  gov: '政府',
};

const SOURCE_TYPE_COLORS: Record<Issue['sourceType'], string> = {
  twitter: 'bg-sky-100 text-sky-800',
  news_jp: 'bg-indigo-100 text-indigo-800',
  news_global: 'bg-violet-100 text-violet-800',
  gov: 'bg-teal-100 text-teal-800',
};

export default function IssueCard({ issue }: IssueCardProps) {
  const categoryColor =
    CATEGORY_COLORS[issue.category as IssueCategoryType] ?? 'bg-gray-100 text-gray-800';
  const categoryLabel =
    CATEGORY_LABELS[issue.category as IssueCategoryType] ?? issue.category;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}>
          {categoryLabel}
        </span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_TYPE_COLORS[issue.sourceType]}`}
        >
          {SOURCE_TYPE_LABELS[issue.sourceType]}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold leading-snug text-gray-900">
        <Link
          to={`/issues/${issue.id}`}
          className="hover:text-blue-600 hover:underline"
        >
          {issue.originalTitle}
        </Link>
      </h3>

      {issue.summaryJa && (
        <p className="mb-3 line-clamp-2 text-xs text-gray-600">{issue.summaryJa}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ScoreBadge label="深刻度" score={issue.severityScore} size="sm" />
        <ScoreBadge label="アプリ化" score={issue.appifiabilityScore} size="sm" />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>{issue.source}</span>
        <span>{formatDate(issue.publishedAt)}</span>
      </div>
    </div>
  );
}
