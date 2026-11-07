import { useParams, Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import ScoreBadge from '../components/common/ScoreBadge';
import Loading from '../components/common/Loading';
import ErrorBox from '../components/common/ErrorBox';
import { useIdeaById } from '../hooks/useIssues';
import { CATEGORY_LABELS, CATEGORY_COLORS, type IssueCategoryType } from '../lib/categories';
import { formatDate, getDifficultyLabel, getDifficultyColor } from '../lib/formatters';
import { safeHref } from '../lib/safeHref';

const SOURCE_TYPE_LABELS = {
  twitter: 'Twitter',
  news_jp: '国内ニュース',
  news_global: '海外ニュース',
  gov: '政府',
} as const;

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const parsedId = Number(id);
  const isValidId = Number.isInteger(parsedId) && parsedId > 0;
  const { data: issue, isLoading, error } = useIdeaById(isValidId ? parsedId : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            to="/ideas"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← アイデア一覧に戻る
          </Link>
        </div>

        {!isValidId && <ErrorBox message="無効なIDです" />}
        {isValidId && isLoading && <Loading />}
        {isValidId && error && <ErrorBox message="アイデアデータの取得に失敗しました" />}

        {issue && (
          <div className="space-y-6">
            {/* App Idea section — prominently at top */}
            {issue.proposedAppIdea && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <ScoreBadge label="アプリ化スコア" score={issue.appifiabilityScore} size="md" />
                  {issue.difficulty && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor(issue.difficulty)}`}
                    >
                      {getDifficultyLabel(issue.difficulty)}
                    </span>
                  )}
                </div>

                <h1 className="mb-4 text-xl font-bold text-blue-900">アプリ化アイデア</h1>

                <p className="mb-6 text-base leading-relaxed text-blue-800">
                  {issue.proposedAppIdea}
                </p>

                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {issue.targetUsers && (
                    <div>
                      <h3 className="mb-1 text-xs font-semibold text-blue-700">ターゲットユーザー</h3>
                      <p className="text-sm text-blue-800">{issue.targetUsers}</p>
                    </div>
                  )}
                  {issue.difficulty && (
                    <div>
                      <h3 className="mb-1 text-xs font-semibold text-blue-700">開発難易度</h3>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor(issue.difficulty)}`}
                      >
                        {getDifficultyLabel(issue.difficulty)}
                      </span>
                    </div>
                  )}
                </div>

                {issue.mvpFeatures && issue.mvpFeatures.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-blue-700">MVP機能</h3>
                    <ul className="space-y-2">
                      {issue.mvpFeatures.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Source issue detail */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-gray-900">元の社会課題</h2>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    CATEGORY_COLORS[issue.category as IssueCategoryType] ?? 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {CATEGORY_LABELS[issue.category as IssueCategoryType] ?? issue.category}
                </span>
                <span className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                  {SOURCE_TYPE_LABELS[issue.sourceType] ?? issue.sourceType}
                </span>
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {issue.source}
                </span>
              </div>

              <h3 className="mb-3 text-base font-semibold leading-snug text-gray-900">
                {issue.originalTitle}
              </h3>

              <div className="mb-4 flex flex-wrap gap-3">
                <ScoreBadge label="深刻度" score={issue.severityScore} />
                <ScoreBadge label="緊急度" score={issue.urgencyScore} />
                <ScoreBadge label="アプリ化スコア" score={issue.appifiabilityScore} />
              </div>

              <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
                <span>公開: {formatDate(issue.publishedAt)}</span>
                {safeHref(issue.originalUrl) && (
                  <a
                    href={safeHref(issue.originalUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    元記事を見る →
                  </a>
                )}
              </div>

              {issue.summaryJa && (
                <div className="rounded-md bg-gray-50 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">要約</h3>
                  <p className="text-sm leading-relaxed text-gray-700">{issue.summaryJa}</p>
                </div>
              )}

              {issue.affectedDomain && issue.affectedDomain.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">影響領域</h3>
                  <div className="flex flex-wrap gap-2">
                    {issue.affectedDomain.map((domain) => (
                      <span
                        key={domain}
                        className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
