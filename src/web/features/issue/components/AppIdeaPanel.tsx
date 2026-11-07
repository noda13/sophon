import type { Issue } from '../../../../shared/schema/issue';
import { ScoreBadge } from '../../../ui/ScoreBadge';
import { DifficultyBadge } from './Badge';

interface AppIdeaPanelProps {
  issue: Issue;
  headingLevel: 'h1' | 'h2';
  showScore?: boolean;
}

export function AppIdeaPanel({ issue, headingLevel: Heading, showScore = false }: AppIdeaPanelProps) {
  return (
    <section className="rounded-lg border border-accent/40 bg-accent-muted/40 p-6">
      {showScore && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <ScoreBadge label="アプリ化スコア" score={issue.appifiabilityScore} higherIsBetter />
          {issue.difficulty && <DifficultyBadge difficulty={issue.difficulty} />}
        </div>
      )}

      <Heading className="mb-4 text-xl font-bold text-fg">アプリ化アイデア</Heading>
      <p className="mb-6 text-base leading-relaxed text-fg">{issue.proposedAppIdea}</p>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {issue.targetUsers && (
          <div>
            <h3 className="mb-1 text-xs font-semibold text-fg-muted">ターゲットユーザー</h3>
            <p className="text-sm text-fg">{issue.targetUsers}</p>
          </div>
        )}
        {issue.difficulty && !showScore && (
          <div>
            <h3 className="mb-1 text-xs font-semibold text-fg-muted">開発難易度</h3>
            <DifficultyBadge difficulty={issue.difficulty} />
          </div>
        )}
      </div>

      {issue.mvpFeatures.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">MVP機能</h3>
          <ul className="space-y-2">
            {issue.mvpFeatures.map((feature, i) => (
              <li key={`${i}-${feature}`} className="flex items-start gap-2 text-sm text-fg">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
