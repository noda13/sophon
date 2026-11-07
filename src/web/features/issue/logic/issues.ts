import { z } from 'zod';
import { IssueCategorySchema, type Idea, type Issue } from '../../../../shared/schema/issue';

export const CategoryFilterSchema = z.union([IssueCategorySchema, z.literal('none')]);
export type CategoryFilter = z.infer<typeof CategoryFilterSchema>;

export const IssueSortSchema = z.enum(['newest', 'severity', 'urgency', 'appifiability']);
export type IssueSort = z.infer<typeof IssueSortSchema>;

export const ISSUE_SORT_LABELS: Record<IssueSort, string> = {
  newest: '新着順',
  severity: '深刻度順',
  urgency: '緊急度順',
  appifiability: 'アプリ化スコア順',
};

export const DEFAULT_ISSUE_SORT: IssueSort = 'newest';
export const DEFAULT_IDEA_SORT: IssueSort = 'appifiability';

type Scored = Pick<Issue, 'severityScore' | 'urgencyScore' | 'appifiabilityScore' | 'publishedAt'>;

function publishedMs(item: Pick<Issue, 'publishedAt'>): number {
  const ms = Date.parse(item.publishedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

const SCORE_KEY = {
  severity: 'severityScore',
  urgency: 'urgencyScore',
  appifiability: 'appifiabilityScore',
} as const;

// スコアが同点のときは新しい順にして、並びが入力の順序に依存しないようにする
export function sortByKey<T extends Scored>(items: readonly T[], sort: IssueSort): T[] {
  const copy = [...items];
  if (sort === 'newest') return copy.sort((a, b) => publishedMs(b) - publishedMs(a));
  const key = SCORE_KEY[sort];
  return copy.sort((a, b) => b[key] - a[key] || publishedMs(b) - publishedMs(a));
}

export interface IssueFilter {
  category?: CategoryFilter | undefined;
  sourceType?: Issue['sourceType'] | undefined;
  difficulty?: Exclude<Issue['difficulty'], ''> | undefined;
}

export function filterItems<T extends Pick<Issue, 'category' | 'sourceType' | 'difficulty'>>(
  items: readonly T[],
  { category, sourceType, difficulty }: IssueFilter,
): T[] {
  return items.filter((item) => {
    if (category === 'none' ? item.category !== '' : category !== undefined && item.category !== category) return false;
    if (sourceType !== undefined && item.sourceType !== sourceType) return false;
    if (difficulty !== undefined && item.difficulty !== difficulty) return false;
    return true;
  });
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

// URL の page は手で書き換えられるため、範囲外は端に丸める
export function paginate<T>(items: readonly T[], page: number | undefined, pageSize: number): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page ?? 1)), pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, total };
}

export function topIdeas(ideas: readonly Idea[], limit: number): Idea[] {
  return sortByKey(ideas, 'appifiability').slice(0, limit);
}

export function findById<T extends { id: string }>(items: readonly T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}
