export const ISSUE_CATEGORIES = [
  'employment_economy',
  'healthcare_welfare',
  'education',
  'childcare_family',
  'aging_care',
  'governance',
  'environment_disaster',
  'community_regional',
] as const;

export type IssueCategoryType = (typeof ISSUE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<IssueCategoryType, string> = {
  employment_economy: '雇用・経済',
  healthcare_welfare: '医療・福祉',
  education: '教育',
  childcare_family: '子育て・家族',
  aging_care: '高齢化・介護',
  governance: '行政・ガバナンス',
  environment_disaster: '環境・災害',
  community_regional: 'コミュニティ・地域',
};

export const DIFFICULTY_LEVELS = ['low', 'medium', 'high'] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export function getScoreLevel(score: number): string {
  if (score < 20) return 'low';
  if (score < 40) return 'moderate';
  if (score < 60) return 'elevated';
  if (score < 80) return 'high';
  return 'critical';
}

import { z } from 'zod';

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const issueQuerySchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  category: z.string().optional(),
  sourceType: z.string().optional(),
  minSeverity: z.coerce.number().int().min(0).max(100).optional(),
});

export const ideaQuerySchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  difficulty: z.string().optional(),
});
