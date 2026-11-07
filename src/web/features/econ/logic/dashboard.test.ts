import { describe, expect, it } from 'vitest';
import type { EconomicEvent, EconomicIndicator, NewsArticle, RiskAssessment } from '../../../../shared/schema/econ';
import {
  buildTrend,
  daysUntil,
  describeDelta,
  isIndicatorStale,
  selectTopNews,
  sourceNewsFor,
  upcomingEvents,
} from './dashboard';

const article = (id: string, relevanceScore: number): NewsArticle => ({
  id,
  source: 's',
  originalTitle: id,
  originalUrl: 'https://example.com',
  publishedAt: '2026-01-01T00:00:00Z',
  summaryJa: '',
  relevanceScore,
  riskCategories: [],
});

const assessment = (category: RiskAssessment['category'], assessedAt: string, score: number): RiskAssessment => ({
  category,
  score,
  level: 'low',
  summaryJa: '',
  factorsJa: [],
  assessedAt,
});

describe('selectTopNews', () => {
  it('関連度の低い記事を除き、関連度の降順で上限まで返す', () => {
    const news = [article('a', 40), article('b', 10), article('c', 90), article('d', 30)];
    expect(selectTopNews(news, { limit: 2 }).map((n) => n.id)).toEqual(['c', 'a']);
    expect(selectTopNews(news).map((n) => n.id)).toEqual(['c', 'a', 'd']);
  });

  it('先頭 window 件より後ろの記事は対象にしない', () => {
    const news = [article('a', 40), article('b', 99)];
    expect(selectTopNews(news, { window: 1 }).map((n) => n.id)).toEqual(['a']);
  });

  it('入力を破壊的に並べ替えない', () => {
    const news = [article('a', 40), article('b', 90)];
    selectTopNews(news);
    expect(news.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('sourceNewsFor', () => {
  it('sourceNewsIds の順に、見つかった記事だけ返す', () => {
    const risk = { ...assessment('technology', '2026-01-01', 1), sourceNewsIds: ['b', 'zzz', 'a'] };
    expect(sourceNewsFor(risk, [article('a', 1), article('b', 1)]).map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('sourceNewsIds がなければ空', () => {
    expect(sourceNewsFor(assessment('technology', '2026-01-01', 1), [article('a', 1)])).toEqual([]);
  });
});

describe('isIndicatorStale', () => {
  const base: EconomicIndicator = {
    code: 'VIX', name: 'VIX', value: 1, previousValue: null, unit: '', source: 's', recordedAt: '2026-01-10T00:00:00Z',
  };
  const now = new Date('2026-01-12T00:00:00Z').getTime();

  it('stale フラグが立っていれば古い', () => {
    expect(isIndicatorStale({ ...base, stale: true }, now)).toBe(true);
  });

  it('3日を超えると古く、ちょうど3日は古くない', () => {
    expect(isIndicatorStale(base, now)).toBe(false);
    expect(isIndicatorStale(base, new Date('2026-01-13T00:00:00Z').getTime())).toBe(false);
    expect(isIndicatorStale(base, new Date('2026-01-13T00:00:01Z').getTime())).toBe(true);
  });

  it('日付が読めない場合は古いとみなさない', () => {
    expect(isIndicatorStale({ ...base, recordedAt: 'x' }, now)).toBe(false);
  });
});

describe('daysUntil / upcomingEvents', () => {
  const now = new Date(2026, 0, 10, 15, 30);

  it('日付の差を日数で返す', () => {
    expect(daysUntil('2026-01-10', now)).toBe(0);
    expect(daysUntil('2026-01-11', now)).toBe(1);
    expect(daysUntil('2026-01-09', now)).toBe(-1);
  });

  it('過去のイベントを除く', () => {
    const events: EconomicEvent[] = [
      { date: '2026-01-09', titleJa: 'past', region: 'US', importance: 'high' },
      { date: '2026-01-10', titleJa: 'today', region: 'JP', importance: 'medium' },
      { date: '2026-01-20', titleJa: 'later', region: 'EU', importance: 'high' },
    ];
    expect(upcomingEvents(events, now).map((e) => [e.event.titleJa, e.days])).toEqual([
      ['today', 0],
      ['later', 10],
    ]);
  });
});

describe('buildTrend', () => {
  it('カテゴリをまたいで日付ごとにまとめ、日付の昇順に並べる', () => {
    const trend = buildTrend({
      technology: [assessment('technology', '2026-01-12T12:00:00', 50), assessment('technology', '2026-01-10T12:00:00', 40)],
      social_policy: [assessment('social_policy', '2026-01-10T13:00:00', 60)],
    });
    expect(trend.map((p) => p.dateKey)).toEqual(['2026-01-10', '2026-01-12']);
    expect(trend[0]?.scores).toEqual({ technology: 40, social_policy: 60 });
    expect(trend[1]?.scores).toEqual({ technology: 50 });
  });

  it('履歴が空なら空配列', () => {
    expect(buildTrend({})).toEqual([]);
  });

  it('日付が読めない行は無視する', () => {
    expect(buildTrend({ technology: [assessment('technology', 'x', 1)] })).toEqual([]);
  });
});

describe('describeDelta', () => {
  it('符号ごとに向きと表記を返す', () => {
    expect(describeDelta(3)).toEqual({ text: '↑+3', direction: 'up' });
    expect(describeDelta(-2)).toEqual({ text: '↓-2', direction: 'down' });
    expect(describeDelta(0)).toEqual({ text: '→0', direction: 'flat' });
  });
});
