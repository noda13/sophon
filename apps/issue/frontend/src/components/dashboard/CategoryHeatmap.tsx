import { useNavigate } from 'react-router-dom';
import { useCategorySummary } from '../../hooks/useIssues';
import { CATEGORY_LABELS, type IssueCategoryType } from '../../lib/categories';
import { getScoreColor } from '../../lib/formatters';
import Loading from '../common/Loading';
import ErrorBox from '../common/ErrorBox';

export default function CategoryHeatmap() {
  const { data: summaries, isLoading, error } = useCategorySummary();
  const navigate = useNavigate();

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox message="カテゴリデータの取得に失敗しました" />;
  if (!summaries || summaries.length === 0) return null;

  const handleCategoryClick = (category: string) => {
    navigate(`/?category=${category}`);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-base font-bold text-gray-900">カテゴリ別ヒートマップ</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((summary) => {
          const label =
            CATEGORY_LABELS[summary.category as IssueCategoryType] ?? summary.category;
          const severityColor = getScoreColor(summary.avgSeverity);
          const appColor = getScoreColor(summary.avgAppifiability);

          return (
            <button
              key={summary.category}
              onClick={() => handleCategoryClick(summary.category)}
              className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <p className="mb-1 text-xs font-semibold text-gray-800 leading-tight">{label}</p>
              <p className="mb-2 text-2xl font-bold text-gray-900">{summary.count}</p>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">深刻度</span>
                  <span className={`font-medium ${severityColor}`}>
                    {Math.round(summary.avgSeverity)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">アプリ化</span>
                  <span className={`font-medium ${appColor}`}>
                    {Math.round(summary.avgAppifiability)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
