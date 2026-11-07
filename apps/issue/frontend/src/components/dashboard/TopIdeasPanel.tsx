import { Link } from 'react-router-dom';
import { useIdeas } from '../../hooks/useIssues';
import IdeaCard from './IdeaCard';
import Loading from '../common/Loading';
import ErrorBox from '../common/ErrorBox';

export default function TopIdeasPanel() {
  const { data: ideas, isLoading, error } = useIdeas({ limit: 6 });

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-base font-bold text-gray-900">アプリ化アイデア Top</h2>
        <Link
          to="/ideas"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          すべて見る →
        </Link>
      </div>

      <div className="p-4">
        {isLoading && <Loading />}
        {error && <ErrorBox message="アイデアの取得に失敗しました" />}
        {ideas && ideas.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-4">アイデアがありません</p>
        )}
        {ideas && ideas.length > 0 && (
          <div className="space-y-3">
            {ideas.map((issue) => (
              <IdeaCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
