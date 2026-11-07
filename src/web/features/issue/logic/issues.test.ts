import { describe, expect, it } from 'vitest';
import { makeIdea, makeIssue } from './fixtures.testutil';
import { filterItems, findById, paginate, sortByKey, topIdeas } from './issues';
import { IdeasSearchSchema, IssuesSearchSchema } from './search';

describe('sortByKey', () => {
  const a = makeIssue({ id: 'a', severityScore: 80, publishedAt: '2026-11-01T00:00:00Z' });
  const b = makeIssue({ id: 'b', severityScore: 80, publishedAt: '2026-11-03T00:00:00Z' });
  const c = makeIssue({ id: 'c', severityScore: 90, publishedAt: '2026-10-01T00:00:00Z' });

  it('新着順は公開日の降順', () => {
    expect(sortByKey([a, c, b], 'newest').map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('スコア順は降順で、同点は新しい順', () => {
    expect(sortByKey([a, b, c], 'severity').map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('入力を変更しない', () => {
    const input = [a, b, c];
    sortByKey(input, 'severity');
    expect(input.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('公開日が壊れていても落ちない', () => {
    const bad = makeIssue({ id: 'bad', publishedAt: 'xx' });
    expect(sortByKey([bad, a], 'newest').map((x) => x.id)).toEqual(['a', 'bad']);
  });
});

describe('filterItems', () => {
  const items = [
    makeIssue({ id: '1', category: 'education', sourceType: 'news_jp' }),
    makeIssue({ id: '2', category: 'governance', sourceType: 'gov' }),
    makeIssue({ id: '3', category: '', sourceType: 'news_global' }),
  ];

  it('条件なしなら全件', () => {
    expect(filterItems(items, {})).toHaveLength(3);
  });

  it('カテゴリで絞る', () => {
    expect(filterItems(items, { category: 'governance' }).map((x) => x.id)).toEqual(['2']);
  });

  it("'none' は未分類だけ", () => {
    expect(filterItems(items, { category: 'none' }).map((x) => x.id)).toEqual(['3']);
  });

  it('ソース種別で絞る', () => {
    expect(filterItems(items, { sourceType: 'news_global' }).map((x) => x.id)).toEqual(['3']);
  });

  it('難易度で絞る', () => {
    const ideas = [makeIdea({ id: 'x', difficulty: 'low' }), makeIdea({ id: 'y', difficulty: 'high' })];
    expect(filterItems(ideas, { difficulty: 'high' }).map((x) => x.id)).toEqual(['y']);
  });

  it('条件は AND で効く', () => {
    expect(filterItems(items, { category: 'education', sourceType: 'gov' })).toEqual([]);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 45 }, (_, i) => i);

  it('1 ページ目を返す', () => {
    const p = paginate(items, undefined, 20);
    expect(p.items).toHaveLength(20);
    expect(p).toMatchObject({ page: 1, pageCount: 3, total: 45 });
  });

  it('最終ページは余り', () => {
    expect(paginate(items, 3, 20).items).toEqual([40, 41, 42, 43, 44]);
  });

  it('範囲外のページは端に丸める', () => {
    expect(paginate(items, 99, 20).page).toBe(3);
    expect(paginate(items, 0, 20).page).toBe(1);
  });

  it('空でも 1 ページ', () => {
    expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});

describe('topIdeas / findById', () => {
  const ideas = [
    makeIdea({ id: 'a', appifiabilityScore: 65 }),
    makeIdea({ id: 'b', appifiabilityScore: 90 }),
    makeIdea({ id: 'c', appifiabilityScore: 75 }),
  ];

  it('アプリ化スコアの高い順に上位を返す', () => {
    expect(topIdeas(ideas, 2).map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('id で引ける。無ければ undefined', () => {
    expect(findById(ideas, 'c')?.id).toBe('c');
    expect(findById(ideas, 'zzz')).toBeUndefined();
  });
});

describe('search schema', () => {
  it('正しい値を通す', () => {
    expect(IssuesSearchSchema.parse({ category: 'education', sourceType: 'gov', sort: 'severity', page: 2 })).toEqual({
      category: 'education',
      sourceType: 'gov',
      sort: 'severity',
      page: 2,
    });
  });

  it('不正な値は未指定に落ちる', () => {
    expect(IssuesSearchSchema.parse({ category: 'x', sort: 'y', page: 0 })).toEqual({
      category: undefined,
      sourceType: undefined,
      sort: undefined,
      page: undefined,
    });
  });

  it('アイデアは難易度を持つ', () => {
    expect(IdeasSearchSchema.parse({ difficulty: 'low' }).difficulty).toBe('low');
  });
});
