import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CategoryTabs } from '../components/CategoryTabs';
import { ArticleCard } from '../components/ArticleCard';
import { EolPanel } from '../components/EolPanel';
import { fetchArticles, fetchEol } from '../services/api';
import type { Category } from '../lib/categories';

type TabValue = Category | 'all';

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse"
        >
          <div className="flex gap-2 mb-2">
            <div className="h-4 w-8 bg-gray-800 rounded" />
            <div className="h-4 w-20 bg-gray-800 rounded" />
          </div>
          <div className="h-4 w-3/4 bg-gray-800 rounded mb-2" />
          <div className="h-3 w-full bg-gray-800 rounded mb-1" />
          <div className="h-3 w-5/6 bg-gray-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<TabValue>('all');

  const categoryFilter: Category | undefined =
    selectedCategory === 'all' ? undefined : selectedCategory;

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', selectedCategory],
    queryFn: () => fetchArticles(categoryFilter, 50),
  });

  const { data: eolItems, isLoading: eolLoading } = useQuery({
    queryKey: ['eol'],
    queryFn: fetchEol,
  });

  return (
    <div>
      <CategoryTabs selected={selectedCategory} onChange={setSelectedCategory} />

      {/* Article list */}
      {articlesLoading ? (
        <LoadingSkeleton />
      ) : !articles || articles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">記事がありません</p>
          <p className="text-sm mt-1">データ収集後に表示されます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* EOL Panel */}
      {!eolLoading && eolItems && eolItems.length > 0 && (
        <EolPanel items={eolItems} />
      )}
    </div>
  );
}
