import type { InvestmentStrategy, StrategyId } from './InvestmentStrategy.js';
import { KiyoharaStrategy } from './KiyoharaStrategy.js';

export const strategies: InvestmentStrategy[] = [new KiyoharaStrategy()];

export function getStrategy(id: StrategyId): InvestmentStrategy | undefined {
  return strategies.find(s => s.meta.id === id);
}

export function activeStrategies(): InvestmentStrategy[] {
  return strategies.filter(s => s.meta.active);
}

export type { InvestmentStrategy, StrategyId };
export type { StrategyMeta, StockMetrics, StrategyScore, RankingRow, RankingOpts } from './InvestmentStrategy.js';
