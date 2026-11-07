import { useState, useEffect } from 'react';
import { useIssues } from '../../hooks/useIssues';
import { ISSUE_CATEGORIES, CATEGORY_LABELS, type IssueCategoryType } from '../../lib/categories';
import IssueCard from './IssueCard';
import Loading from '../common/Loading';
import ErrorBox from '../common/ErrorBox';
import type { Issue } from '../../lib/types';

interface IssueFeedProps {
  category?: string;
  sourceType?: string;
}

type SourceTypeFilter = Issue['sourceType'] | 'all';

const SOURCE_TYPE_OPTIONS: { value: SourceTypeFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'news_jp', label: '国内' },
  { value: 'news_global', label: '海外' },
  { value: 'gov', label: '政府' },
  { value: 'twitter', label: 'Twitter' },
];

const PAGE_SIZE = 20;

export default function IssueFeed({ category: propCategory, sourceType: propSourceType }: IssueFeedProps) {
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>(
    (propSourceType as SourceTypeFilter) ?? 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(propCategory ?? 'all');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Sync external category/sourceType props into local state when they change
  useEffect(() => {
    setCategoryFilter(propCategory ?? 'all');
    setDisplayCount(PAGE_SIZE);
  }, [propCategory]);

  useEffect(() => {
    setSourceTypeFilter((propSourceType as SourceTypeFilter) ?? 'all');
    setDisplayCount(PAGE_SIZE);
  }, [propSourceType]);

  const effectiveSourceType = sourceTypeFilter === 'all' ? undefined : sourceTypeFilter;
  const effectiveCategory = categoryFilter === 'all' ? undefined : categoryFilter;

  const { data: issues, isLoading, error } = useIssues({
    category: effectiveCategory,
    sourceType: effectiveSourceType,
  });

  const visibleIssues = issues?.slice(0, displayCount) ?? [];
  const hasMore = (issues?.length ?? 0) > displayCount;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="mb-3 text-base font-bold text-gray-900">社会課題フィード</h2>

        {/* Source type filter */}
        <div className="mb-2 flex flex-wrap gap-1">
          {SOURCE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSourceTypeFilter(opt.value);
                setDisplayCount(PAGE_SIZE);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sourceTypeFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => {
              setCategoryFilter('all');
              setDisplayCount(PAGE_SIZE);
            }}
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
              onClick={() => {
                setCategoryFilter(cat);
                setDisplayCount(PAGE_SIZE);
              }}
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

      <div className="p-4">
        {isLoading && <Loading />}
        {error && <ErrorBox message="課題データの取得に失敗しました" />}
        {!isLoading && !error && visibleIssues.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">該当する課題がありません</p>
        )}
        {visibleIssues.length > 0 && (
          <>
            <div className="space-y-3">
              {visibleIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setDisplayCount((prev) => prev + PAGE_SIZE)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  もっと見る
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
