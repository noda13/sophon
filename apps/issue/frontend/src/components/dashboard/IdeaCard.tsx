import { Link } from 'react-router-dom';
import type { Issue } from '../../lib/types';
import { CATEGORY_LABELS, CATEGORY_COLORS, type IssueCategoryType } from '../../lib/categories';
import { getDifficultyLabel, getDifficultyColor } from '../../lib/formatters';
import ScoreBadge from '../common/ScoreBadge';

interface IdeaCardProps {
  issue: Issue;
}

export default function IdeaCard({ issue }: IdeaCardProps) {
  const categoryColor =
    CATEGORY_COLORS[issue.category as IssueCategoryType] ?? 'bg-gray-100 text-gray-800';
  const categoryLabel =
    CATEGORY_LABELS[issue.category as IssueCategoryType] ?? issue.category;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <ScoreBadge label="アプリ化スコア" score={issue.appifiabilityScore} size="md" />
        <div className="flex flex-wrap gap-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}>
            {categoryLabel}
          </span>
          {issue.difficulty && (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor(issue.difficulty)}`}
            >
              {getDifficultyLabel(issue.difficulty)}
            </span>
          )}
        </div>
      </div>

      {issue.proposedAppIdea && (
        <p className="mb-3 text-sm text-gray-700 line-clamp-3">{issue.proposedAppIdea}</p>
      )}

      <div className="mt-auto pt-2">
        <Link
          to={`/ideas/${issue.id}`}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          詳細を見る
        </Link>
      </div>
    </div>
  );
}
