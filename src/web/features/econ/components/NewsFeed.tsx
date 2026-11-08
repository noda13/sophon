import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import { safeHref } from '../../../ui/safeHref';
import type { NewsArticle } from '../../../../shared/schema/econ';
import { NEWS_IMPORTANT_SCORE } from '../logic/dashboard';
import { formatDate } from '../logic/formatters';
import { categoryLabels } from '../logic/riskColors';

interface Props {
  articles: readonly NewsArticle[];
  hasAnyNews: boolean;
  isError?: boolean;
}

export function NewsFeed({ articles, hasAnyNews, isError = false }: Props) {
  return (
    <section aria-label="注目ニュース">
      <h2 className="mb-3 text-lg font-semibold text-fg">注目ニュース（関連度順）</h2>
      {isError ? (
        <ErrorBox message="ニュースの取得に失敗しました。" />
      ) : !hasAnyNews ? (
        <EmptyState title="ニュースデータがありません" />
      ) : articles.length === 0 ? (
        <EmptyState title="関連度の高いニュースはありません" />
      ) : (
        <ul className="space-y-3">
          {articles.map((article) => {
            const href = safeHref(article.originalUrl);
            return (
              <li key={article.id} className="rounded-lg border border-border bg-surface-raised p-4">
                <div className="mb-1 flex items-center gap-2 text-xs text-fg-subtle">
                  <span className="font-mono uppercase">{article.source}</span>
                  <span aria-hidden="true">|</span>
                  <span>{formatDate(article.publishedAt)}</span>
                  {article.relevanceScore >= NEWS_IMPORTANT_SCORE && (
                    <span className="rounded bg-danger-muted px-1.5 py-0.5 text-danger">重要</span>
                  )}
                </div>
                <h3 className="mb-1 text-sm font-medium text-fg">
                  {href === null ? (
                    article.originalTitle
                  ) : (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">
                      {article.originalTitle}
                    </a>
                  )}
                </h3>
                <p className="mb-2 text-sm text-fg-muted">{article.summaryJa}</p>
                <div className="flex flex-wrap gap-1">
                  {article.riskCategories.map((cat) => (
                    <span key={cat} className="rounded bg-surface-overlay px-2 py-0.5 text-xs text-fg-muted">
                      {categoryLabels[cat] ?? cat}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
