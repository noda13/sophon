import { Link } from '@tanstack/react-router';
import type { Idea } from '../../../../shared/schema/issue';
import { Card } from '../../../ui/Card';
import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import { Loading } from '../../../ui/Loading';
import { IdeaCard } from './IdeaCard';

interface TopIdeasPanelProps {
  ideas: readonly Idea[];
  isPending: boolean;
  error: Error | null;
}

export function TopIdeasPanel({ ideas, isPending, error }: TopIdeasPanelProps) {
  return (
    <Card
      title="アプリ化アイデア Top"
      actions={
        <Link to="/issue/ideas" className="text-sm text-accent hover:underline">
          すべて見る →
        </Link>
      }
    >
      {isPending && <Loading />}
      {error && <ErrorBox message="アイデアの取得に失敗しました" />}
      {!isPending && !error && ideas.length === 0 && <EmptyState title="アイデアがありません" />}
      {ideas.length > 0 && (
        <div className="space-y-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </Card>
  );
}
