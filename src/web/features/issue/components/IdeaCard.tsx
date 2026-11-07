import { Link } from '@tanstack/react-router';
import type { Idea } from '../../../../shared/schema/issue';
import { ScoreBadge } from '../../../ui/ScoreBadge';
import { CategoryBadge, DifficultyBadge } from './Badge';

export function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-border-strong">
      <div className="mb-3 flex items-start justify-between gap-2">
        <ScoreBadge label="アプリ化" score={idea.appifiabilityScore} higherIsBetter />
        <div className="flex flex-wrap justify-end gap-1">
          <CategoryBadge category={idea.category} />
          {idea.difficulty && <DifficultyBadge difficulty={idea.difficulty} />}
        </div>
      </div>

      {idea.proposedAppIdea && <p className="mb-3 line-clamp-3 text-sm text-fg">{idea.proposedAppIdea}</p>}

      <p className="mb-3 line-clamp-1 text-xs text-fg-subtle">{idea.originalTitle}</p>

      <div className="mt-auto pt-2">
        <Link
          to="/issue/ideas/$id"
          params={{ id: idea.id }}
          className="inline-flex items-center rounded-md bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-surface"
        >
          詳細を見る
        </Link>
      </div>
    </article>
  );
}
