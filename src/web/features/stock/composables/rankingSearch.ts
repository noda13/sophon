import { z } from 'zod';
import { StrategyIdSchema } from '../../../../shared/schema/stock';
import { tableSearchSchema } from '../../../composables/useDataTable';

export const DEFAULT_STRATEGY = 'kiyohara';
export const RANKING_PAGE_SIZE = 50;

// 壊れた URL でエラー画面にせず、その条件だけ無かったことにする
export const rankingSearchSchema = tableSearchSchema.extend({
  strategy: StrategyIdSchema.optional().catch(undefined),
  // 時価総額は URL を読みやすくするため億円で持つ
  minCap: z.number().nonnegative().optional().catch(undefined),
  maxCap: z.number().nonnegative().optional().catch(undefined),
  exclude: z.array(z.string()).optional().catch(undefined),
});
export type RankingSearch = z.output<typeof rankingSearchSchema>;
