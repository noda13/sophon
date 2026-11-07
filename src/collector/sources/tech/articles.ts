import type { Article } from '../../../shared/schema/tech';
import type { FeedItem } from '../../core/rss';
import type { TechFeed } from './feeds';
import type { SummaryResponse } from './prompts';

export const MAX_ARTICLES = 200;
export const MAX_FRESH_PER_FEED = 30;

export function toArticle(item: FeedItem, feed: TechFeed): Article {
  return {
    id: item.id,
    source: feed.source,
    category: feed.hint,
    importance: '中',
    originalTitle: item.title,
    originalUrl: item.url,
    publishedAt: item.publishedAt,
    summaryJa: '',
  };
}

const byNewest = (a: Article, b: Article) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

// arXiv のように 1 回で大量に返す feed が枠を占めないよう、新着は feed ごとに新しい順で上限を設ける。
export function capFreshPerFeed(fresh: readonly Article[], cap = MAX_FRESH_PER_FEED): Article[] {
  const counts = new Map<string, number>();
  return [...fresh].sort(byNewest).filter((a) => {
    const n = (counts.get(a.source) ?? 0) + 1;
    counts.set(a.source, n);
    return n <= cap;
  });
}

// 要約済みを優先して残し、未要約には最低でも 1 回の要約上限と同じ数だけ枠を空ける。
// 新着の未要約を先頭にするのは、溜まった古い未要約に押し出されて要約の機会を失わないため。
export function retainArticles(
  all: readonly Article[],
  freshIds: ReadonlySet<string>,
  opts: { max?: number; unsummarizedSlots: number; maxAttempts: number },
): Article[] {
  const max = opts.max ?? MAX_ARTICLES;
  const sorted = [...all].sort(byNewest);
  if (sorted.length <= max) return sorted;

  const summarized = sorted.filter((a) => a.summaryJa.length > 0);
  const pending = sorted.filter((a) => a.summaryJa.length === 0);
  const gaveUp = (a: Article) => (a.summaryAttempts ?? 0) >= opts.maxAttempts;
  const unsummarized = [
    ...pending.filter((a) => freshIds.has(a.id)),
    ...pending.filter((a) => !freshIds.has(a.id) && !gaveUp(a)),
    ...pending.filter((a) => !freshIds.has(a.id) && gaveUp(a)),
  ];
  // 要約済みが少ないうちは、空いた枠を未要約で埋める。
  const slots = Math.min(unsummarized.length, Math.max(opts.unsummarizedSlots, max - summarized.length));
  return [...summarized.slice(0, max - slots), ...unsummarized.slice(0, slots)].sort(byNewest);
}

/** 範囲外の index と重複した index は捨て、反映した件数を返す。 */
export function applySummaries(batch: Article[], response: SummaryResponse): number {
  const filled = new Set<number>();
  for (const r of response.results) {
    const target = batch[r.index];
    if (!target || filled.has(r.index) || r.summaryJa.trim().length === 0) continue;
    target.summaryJa = r.summaryJa;
    target.category = r.category;
    target.importance = r.importance;
    delete target.summaryAttempts;
    filled.add(r.index);
  }
  return filled.size;
}
