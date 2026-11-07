import { z } from 'zod';

export const STRATEGY_IDS = ['kiyohara', 'graham', 'buffett', 'lynch', 'dividend', 'composite'] as const;
export const StrategyIdSchema = z.enum(STRATEGY_IDS);
export type StrategyId = z.infer<typeof StrategyIdSchema>;

export const StrategyScoreSchema = z.object({
  score: z.number(),
  components: z.record(z.string(), z.number().nullable()),
  reason: z.string(),
});

export const StrategyMetaSchema = z.object({
  id: StrategyIdSchema,
  displayName: z.string(),
  description: z.string(),
  active: z.boolean(),
});

export const StockMetricsSchema = z.object({
  code: z.string(),
  name: z.string(),
  sector33Name: z.string().nullable(),
  marketSegment: z.string().nullable(),
  marketCap: z.number(),
  netCash: z.number().nullable(),
  netCashRatio: z.number().nullable(),
  cashNeutralPer: z.number().nullable(),
  per: z.number().nullable(),
  pbr: z.number().nullable(),
  profit: z.number().nullable(),
  equity: z.number().nullable(),
});

export const RankingRowSchema = StockMetricsSchema.extend({
  rank: z.number(),
  strategyScore: StrategyScoreSchema,
  snapshotAt: z.string(),
});

export const FinancialStatementSchema = z.object({
  id: z.string(),
  code: z.string(),
  fiscalYear: z.number(),
  typeOfCurrentPeriod: z.string(),
  disclosedDate: z.string(),
  periodEndDate: z.string(),
  netSales: z.number().nullable(),
  operatingProfit: z.number().nullable(),
  ordinaryProfit: z.number().nullable(),
  profit: z.number().nullable(),
  totalAssets: z.number().nullable(),
  equity: z.number().nullable(),
  cashAndEquivalents: z.number().nullable(),
  sharesOutstanding: z.number().nullable(),
});

export const SnapshotSchema = z.object({
  id: z.string(),
  snapshotAt: z.string(),
  marketCap: z.number(),
  netCash: z.number().nullable(),
  netCashRatio: z.number().nullable(),
  cashNeutralPer: z.number().nullable(),
  per: z.number().nullable(),
  pbr: z.number().nullable(),
});

export const StockProfileSchema = z.object({
  code: z.string(),
  name: z.string(),
  sector33Name: z.string().nullable(),
  sector33Code: z.string().nullable(),
  sector17Code: z.string().nullable(),
  marketSegment: z.string().nullable(),
  scaleCategory: z.string().nullable(),
  updatedAt: z.string(),
  snapshots: z.array(SnapshotSchema),
  statements: z.array(FinancialStatementSchema).optional(),
});

export const StockDetailSchema = z.object({
  profile: StockProfileSchema,
  history: z.array(FinancialStatementSchema),
  strategies: z.record(z.string(), StrategyScoreSchema),
});

export const StrategiesFileSchema = z.array(StrategyMetaSchema);
export const StocksFileSchema = z.array(StockMetricsSchema);
export const RankingFileSchema = z.array(RankingRowSchema);

export type StrategyScore = z.infer<typeof StrategyScoreSchema>;
export type StrategyMeta = z.infer<typeof StrategyMetaSchema>;
export type StockMetrics = z.infer<typeof StockMetricsSchema>;
export type RankingRow = z.infer<typeof RankingRowSchema>;
export type FinancialStatement = z.infer<typeof FinancialStatementSchema>;
export type StockDetail = z.infer<typeof StockDetailSchema>;
