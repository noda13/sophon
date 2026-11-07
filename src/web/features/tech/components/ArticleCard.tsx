import type { Article } from '../../../../shared/schema/tech';
import { safeHref } from '../../../ui/safeHref';
import { CategoryBadge } from './CategoryBadge';
import { ImportanceBadge } from './ImportanceBadge';

function formatPublishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '---';
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-border-strong">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ImportanceBadge importance={article.importance} />
        <span className="rounded border border-border bg-surface-overlay px-2 py-0.5 text-xs text-fg-muted">
          {article.source}
        </span>
        <time dateTime={article.publishedAt} className="ml-auto text-xs text-fg-subtle">
          {formatPublishedAt(article.publishedAt)}
        </time>
      </div>
      <h3 className="mb-1.5 text-sm font-semibold leading-snug text-fg">
        <a
          href={safeHref(article.originalUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-accent"
        >
          {article.originalTitle}
        </a>
      </h3>
      <p className="mb-3 text-xs leading-relaxed text-fg-muted">{article.summaryJa}</p>
      <CategoryBadge category={article.category} />
    </article>
  );
}
