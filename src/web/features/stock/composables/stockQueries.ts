import {
  RankingFileSchema,
  StockDetailSchema,
  type StrategyId,
  StrategiesFileSchema,
} from '../../../../shared/schema/stock';
import { AnyMetaSchema } from '../../../../shared/schema/meta';
import { sourceQueryOptions } from '../../../composables/useSourceQuery';

// ルートの loader での先読みとフックの取得が同じ query key になるよう、options はここに集める
export const stockQueryOptions = {
  strategies: () => sourceQueryOptions('stock', 'strategies.json', StrategiesFileSchema),
  ranking: (strategy: StrategyId) => sourceQueryOptions('stock', `ranking-${strategy}.json`, RankingFileSchema),
  detail: (code: string) => sourceQueryOptions('stock', `stocks/${encodeURIComponent(code)}.json`, StockDetailSchema),
  meta: () => sourceQueryOptions('stock', 'meta.json', AnyMetaSchema),
};
