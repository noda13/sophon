import { describe, expect, it } from 'vitest';
import { summarizeCounts } from './summary';

describe('summarizeCounts', () => {
  it('stock は銘柄とランキングを表の順に返す', () => {
    expect(summarizeCounts('stock', { rankings: 3, stocks: 100 })).toEqual([
      { label: '銘柄', value: 100 },
      { label: 'ランキング', value: 3 },
    ]);
  });

  it('tech は記事、新着、EOL を返す', () => {
    expect(summarizeCounts('tech', { eol: 2, newArticles: 5, articles: 40 })).toEqual([
      { label: '記事', value: 40 },
      { label: '新着', value: 5 },
      { label: 'EOL', value: 2 },
    ]);
  });

  it('issue は課題、新着、アイデアを返す', () => {
    expect(summarizeCounts('issue', { ideas: 7, newIssues: 4, issues: 120 })).toEqual([
      { label: '課題', value: 120 },
      { label: '新着', value: 4 },
      { label: 'アイデア', value: 7 },
    ]);
  });

  it('econ は記事、指標、リスクを返す', () => {
    expect(summarizeCounts('econ', { risks: 6, indicators: 12, articles: 30 })).toEqual([
      { label: '記事', value: 30 },
      { label: '指標', value: 12 },
      { label: 'リスク', value: 6 },
    ]);
  });

  it('値が 0 のキーと、表に無いキーを出さない', () => {
    expect(summarizeCounts('tech', { articles: 10, newArticles: 0, failedSources: 3, unknown: 9 })).toEqual([
      { label: '記事', value: 10 },
    ]);
  });

  it('数値でないキーを出さない', () => {
    const counts = { articles: 'x', newArticles: Number.NaN, eol: 1 } as unknown as Record<string, number>;
    expect(summarizeCounts('tech', counts)).toEqual([{ label: 'EOL', value: 1 }]);
  });

  it('source の表に無いキーは、他の source の表にあっても出さない', () => {
    expect(summarizeCounts('stock', { articles: 5, indicators: 2 })).toEqual([]);
  });
});
