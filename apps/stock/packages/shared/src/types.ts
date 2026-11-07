import type { z } from 'zod';
import type {
  FinancialStatementSchema,
  RankingRowSchema,
  SnapshotSchema,
  StaticStockDetailSchema,
  StockMetricsSchema,
  StockProfileSchema,
  StrategyIdSchema,
  StrategyMetaSchema,
  StrategyScoreSchema,
} from './schemas';

export type StrategyId = z.infer<typeof StrategyIdSchema>;
export type StrategyMeta = z.infer<typeof StrategyMetaSchema>;
export type StrategyScore = z.infer<typeof StrategyScoreSchema>;
export type StockMetrics = z.infer<typeof StockMetricsSchema>;
export type RankingRow = z.infer<typeof RankingRowSchema>;
export type FinancialStatement = z.infer<typeof FinancialStatementSchema>;
export type StockSnapshot = z.infer<typeof SnapshotSchema>;
export type StockProfile = z.infer<typeof StockProfileSchema>;
export type StaticStockDetail = z.infer<typeof StaticStockDetailSchema>;

export interface StaticMeta {
  generatedAt: string;
  provider: string;
  stockCount: number;
}
