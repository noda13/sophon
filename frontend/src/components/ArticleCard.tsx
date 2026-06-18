import type { Article } from '../services/api';
import { CATEGORY_META } from '../lib/categories';

function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

const IMPORTANCE_STYLES: Record<Article['importance'], string> = {
  '高': 'bg-red-900 text-red-300 border border-red-700',
  '中': 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  '低': 'bg-gray-800 text-gray-400 border border-gray-700',
};

const CATEGORY_COLOR_STYLES: Record<string, string> = {
  blue:   'bg-blue-900 text-blue-300 border border-blue-700',
  purple: 'bg-purple-900 text-purple-300 border border-purple-700',
  red:    'bg-red-900 text-red-300 border border-red-700',
  green:  'bg-green-900 text-green-300 border border-green-700',
};

interface Props {
  article: Article;
}

export function ArticleCard({ article }: Props) {
  const categoryMeta = CATEGORY_META[article.category] ?? CATEGORY_META['trend'];
  const categoryStyle = CATEGORY_COLOR_STYLES[categoryMeta.color] ?? CATEGORY_COLOR_STYLES['blue'];

  const publishedDate = new Date(article.publishedAt).toLocaleDateString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${IMPORTANCE_STYLES[article.importance]}`}>
          {article.importance}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
          {article.source}
        </span>
        <span className="text-xs text-gray-500 ml-auto">{publishedDate}</span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-100 mb-1.5 leading-snug">
        <a
          href={safeHref(article.originalUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 transition-colors"
        >
          {article.originalTitle}
        </a>
      </h3>

      {/* Summary */}
      <p className="text-xs text-gray-400 leading-relaxed mb-3">
        {article.summaryJa}
      </p>

      {/* Category badge */}
      <div className="flex">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${categoryStyle}`}>
          {categoryMeta.label}
        </span>
      </div>
    </article>
  );
}
