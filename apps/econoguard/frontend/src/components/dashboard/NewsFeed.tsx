import { useMemo } from 'react';
import { useNews } from '../../hooks/useNews';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatDate, safeHttpUrl } from '../../lib/formatters';
import { categoryLabels } from '../../lib/riskColors';

export function NewsFeed() {
  const { data: articles, isLoading, isError } = useNews();

  const filtered = useMemo(() => {
    if (!articles) return [];
    return articles
      .filter(a => a.relevanceScore >= 30)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);
  }, [articles]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">注目ニュース（関連度順）</h2>
      {isError ? (
        <p className="text-sm text-red-400">ニュースの取得に失敗しました。</p>
      ) : !articles?.length ? (
        <p className="text-sm text-gray-500">ニュースデータがありません</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">関連度の高いニュースはありません</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((article) => {
            const href = safeHttpUrl(article.originalUrl);
            return (
            <div key={article.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 uppercase font-mono">{article.source}</span>
                <span className="text-xs text-gray-600">|</span>
                <span className="text-xs text-gray-500">{formatDate(article.publishedAt)}</span>
                {article.relevanceScore >= 70 && (
                  <span className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">重要</span>
                )}
              </div>
              <h3 className="text-sm font-medium text-gray-200 mb-1">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-400 hover:underline"
                  >
                    {article.originalTitle}
                  </a>
                ) : (
                  article.originalTitle
                )}
              </h3>
              <p className="text-sm text-gray-400 mb-2">{article.summaryJa}</p>
              <div className="flex gap-1 flex-wrap">
                {article.riskCategories.map((cat) => (
                  <span key={cat} className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                    {categoryLabels[cat] || cat}
                  </span>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
