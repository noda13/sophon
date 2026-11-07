import { describe, expect, it } from 'vitest';
import type { Article } from '../../../../shared/schema/tech';
import { filterArticles, paginate } from './articles';

const article = (id: string, over: Partial<Article> = {}): Article => ({
  id,
  source: 'hackernews',
  category: 'trend',
  importance: '中',
  originalTitle: `Title ${id}`,
  originalUrl: `https://e.com/${id}`,
  publishedAt: '2026-11-01T00:00:00.000Z',
  summaryJa: `要約 ${id}`,
  ...over,
});

describe('filterArticles', () => {
  const all = [
    article('a'),
    article('b', { category: 'ai', originalTitle: 'LLM Update' }),
    article('c', { category: 'ai', summaryJa: '' }),
    article('d', { category: 'security', source: 'cve-feed', summaryJa: '脆弱性の話' }),
  ];

  it('要約のない記事を除く', () => {
    expect(filterArticles(all, {}).map((a) => a.id)).toEqual(['a', 'b', 'd']);
  });

  it('カテゴリで絞り込む', () => {
    expect(filterArticles(all, { category: 'ai' }).map((a) => a.id)).toEqual(['b']);
  });

  it('タイトル・要約・ソースを大文字小文字を区別せずに検索する', () => {
    expect(filterArticles(all, { q: 'llm' }).map((a) => a.id)).toEqual(['b']);
    expect(filterArticles(all, { q: '脆弱性' }).map((a) => a.id)).toEqual(['d']);
    expect(filterArticles(all, { q: 'CVE-FEED' }).map((a) => a.id)).toEqual(['d']);
  });

  it('空白だけの検索語は無視し、カテゴリと併用できる', () => {
    expect(filterArticles(all, { q: '  ' })).toHaveLength(3);
    expect(filterArticles(all, { category: 'ai', q: 'update' }).map((a) => a.id)).toEqual(['b']);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it('指定ページの範囲を返す', () => {
    const p = paginate(items, 2, 10);
    expect(p.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(p).toMatchObject({ page: 2, pageCount: 3, totalCount: 25 });
  });

  it('範囲外のページは端に丸める', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
  });

  it('0件でも1ページとして扱う', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1, totalCount: 0 });
  });
});
