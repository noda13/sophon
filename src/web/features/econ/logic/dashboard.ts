import type {
  EconomicEvent,
  EconomicIndicator,
  NewsArticle,
  RiskAssessment,
  RiskCategory,
} from '../../../../shared/schema/econ';
import { RISK_CATEGORIES } from './riskColors';

const DAY_MS = 24 * 60 * 60 * 1000;

// 新しい順に並んだ news.json の先頭だけを対象にし、古い記事が関連度だけで上位に居座らないようにする
export const NEWS_WINDOW = 50;
export const NEWS_MIN_RELEVANCE = 30;
export const NEWS_LIMIT = 20;
export const NEWS_IMPORTANT_SCORE = 70;

export function selectTopNews(
  news: readonly NewsArticle[],
  { window = NEWS_WINDOW, minRelevance = NEWS_MIN_RELEVANCE, limit = NEWS_LIMIT } = {},
): NewsArticle[] {
  return news
    .slice(0, window)
    .filter((article) => article.relevanceScore >= minRelevance)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

export function sourceNewsFor(risk: RiskAssessment, news: readonly NewsArticle[]): NewsArticle[] {
  const byId = new Map(news.map((article) => [article.id, article]));
  return (risk.sourceNewsIds ?? []).flatMap((id) => {
    const article = byId.get(id);
    return article ? [article] : [];
  });
}

export const INDICATOR_STALE_DAYS = 3;

export function isIndicatorStale(indicator: EconomicIndicator, now: number = Date.now()): boolean {
  if (indicator.stale === true) return true;
  const recordedAt = new Date(indicator.recordedAt).getTime();
  return Number.isFinite(recordedAt) && now - recordedAt > INDICATOR_STALE_DAYS * DAY_MS;
}

export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export interface UpcomingEvent {
  event: EconomicEvent;
  days: number;
}

export function upcomingEvents(events: readonly EconomicEvent[], now: Date = new Date()): UpcomingEvent[] {
  return events
    .map((event) => ({ event, days: daysUntil(event.date, now) }))
    .filter(({ days }) => Number.isFinite(days) && days >= 0);
}

export interface TrendPoint {
  dateKey: string;
  date: string;
  scores: Partial<Record<RiskCategory, number>>;
}

function toLocalDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// 同じ日に複数回評価された場合は後に現れた値を採用する
export function buildTrend(
  history: Partial<Record<RiskCategory, readonly RiskAssessment[]>>,
): TrendPoint[] {
  const points = new Map<string, TrendPoint>();
  for (const category of RISK_CATEGORIES) {
    for (const item of history[category] ?? []) {
      const d = new Date(item.assessedAt);
      if (Number.isNaN(d.getTime())) continue;
      const dateKey = toLocalDateKey(d);
      const point = points.get(dateKey) ?? {
        dateKey,
        date: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        scores: {},
      };
      point.scores[category] = item.score;
      points.set(dateKey, point);
    }
  }
  return [...points.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export function describeDelta(delta: number): { text: string; direction: DeltaDirection } {
  if (delta > 0) return { text: `↑+${delta}`, direction: 'up' };
  if (delta < 0) return { text: `↓${delta}`, direction: 'down' };
  return { text: '→0', direction: 'flat' };
}
