import { z } from 'zod';

export const RISK_CATEGORIES = [
  'currency_finance',
  'geopolitics_supply_chain',
  'technology',
  'social_policy',
] as const;
export const RiskCategorySchema = z.enum(RISK_CATEGORIES);
export type RiskCategory = z.infer<typeof RiskCategorySchema>;

export const RiskLevelSchema = z.enum(['low', 'moderate', 'elevated', 'high', 'critical']);

export const NewsArticleSchema = z.object({
  id: z.string(),
  source: z.string(),
  originalTitle: z.string(),
  originalUrl: z.string(),
  publishedAt: z.string(),
  summaryJa: z.string(),
  relevanceScore: z.number(),
  riskCategories: z.array(z.string()),
  // 要約に失敗した記事の再試行回数（MAX_SUMMARY_ATTEMPTS で打ち切る）
  summaryAttempts: z.number().optional(),
});

export const EconomicIndicatorSchema = z.object({
  code: z.string(),
  name: z.string(),
  value: z.number(),
  previousValue: z.number().nullable(),
  unit: z.string(),
  source: z.string(),
  recordedAt: z.string(),
  stale: z.boolean().optional(),
});

export const RiskAssessmentSchema = z.object({
  category: RiskCategorySchema,
  score: z.number(),
  level: RiskLevelSchema,
  summaryJa: z.string(),
  factorsJa: z.array(z.string()),
  assessedAt: z.string(),
  delta: z.number().optional(),
  changeReasonJa: z.string().optional(),
  sourceNewsIds: z.array(z.string()).optional(),
});

export const CompositeRiskSchema = z.object({
  compositeScore: z.number(),
  level: RiskLevelSchema,
  breakdown: z.array(z.object({ category: RiskCategorySchema, score: z.number(), weight: z.number() })),
  delta: z.number().optional(),
});

export const EconomicEventSchema = z.object({
  date: z.string(),
  titleJa: z.string(),
  region: z.enum(['US', 'JP', 'EU', 'GLOBAL']),
  importance: z.enum(['high', 'medium']),
});

export const NewsFileSchema = z.array(NewsArticleSchema);
export const IndicatorsFileSchema = z.array(EconomicIndicatorSchema);
export const RisksFileSchema = z.array(RiskAssessmentSchema);
export const RiskHistoryFileSchema = z.partialRecord(RiskCategorySchema, z.array(RiskAssessmentSchema));
export const EventsFileSchema = z.array(EconomicEventSchema);

export type NewsArticle = z.infer<typeof NewsArticleSchema>;
export type EconomicIndicator = z.infer<typeof EconomicIndicatorSchema>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export type CompositeRisk = z.infer<typeof CompositeRiskSchema>;
export type EconomicEvent = z.infer<typeof EconomicEventSchema>;
