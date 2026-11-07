import type { Article, TechCategory } from '../../../../shared/schema/tech';

export interface ArticleFilter {
  category?: TechCategory;
  q?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  totalCount: number;
}

// 要約のない記事は本文の手がかりがなく、カテゴリも仮置きなので一覧に出さない
export function filterArticles(articles: readonly Article[], { category, q }: ArticleFilter): Article[] {
  const needle = q?.trim().toLowerCase();
  return articles.filter((a) => {
    if (a.summaryJa.length === 0) return false;
    if (category && a.category !== category) return false;
    if (!needle) return true;
    return [a.originalTitle, a.summaryJa, a.source].some((text) => text.toLowerCase().includes(needle));
  });
}

// 範囲外のページ（絞り込みで件数が減った後の古い URL など）は最終ページに丸める
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageCount,
    totalCount: items.length,
  };
}
