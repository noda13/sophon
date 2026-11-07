import { useState } from 'react';
import Header from '../components/layout/Header';
import IdeaCard from '../components/dashboard/IdeaCard';
import Loading from '../components/common/Loading';
import ErrorBox from '../components/common/ErrorBox';
import { useIdeas } from '../hooks/useIssues';
import { ISSUE_CATEGORIES, CATEGORY_LABELS, type IssueCategoryType } from '../lib/categories';

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'すべて' },
  { value: 'low', label: '難易度:低' },
  { value: 'medium', label: '難易度:中' },
  { value: 'high', label: '難易度:高' },
] as const;

export default function IdeasPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  const effectiveCategory = categoryFilter === 'all' ? undefined : categoryFilter;
  const effectiveDifficulty = difficultyFilter === 'all' ? undefined : difficultyFilter;

  const { data: ideas, isLoading, error } = useIdeas({
    category: effectiveCategory,
    difficulty: effectiveDifficulty,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">アプリ化アイデア一覧</h1>
          <p className="mt-1 text-sm text-gray-500">
            社会課題を解決するアプリのアイデアを一覧表示しています
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          {/* Category filter */}
          <div>
            <span className="mb-2 block text-xs font-semibold text-gray-500">カテゴリ</span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                すべて
              </button>
              {ISSUE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat as IssueCategoryType]}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty filter */}
          <div>
            <span className="mb-2 block text-xs font-semibold text-gray-500">難易度</span>
            <div className="flex flex-wrap gap-1">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDifficultyFilter(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    difficultyFilter === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && <Loading />}
        {error && <ErrorBox message="アイデアデータの取得に失敗しました" />}

        {!isLoading && !error && ideas && (
          <>
            <p className="mb-3 text-sm text-gray-500">{ideas.length}件のアイデア</p>
            {ideas.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
                <p className="text-sm text-gray-500">該当するアイデアがありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ideas.map((issue) => (
                  <IdeaCard key={issue.id} issue={issue} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
