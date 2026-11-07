import type { InvestmentStrategy, StrategyId } from './InvestmentStrategy.js';
import { KiyoharaStrategy } from './KiyoharaStrategy.js';
import { GrahamStrategy } from './GrahamStrategy.js';
import { BuffettStrategy } from './BuffettStrategy.js';
import { LynchStrategy } from './LynchStrategy.js';
import { DividendStrategy } from './DividendStrategy.js';
import { CompositeStrategy } from './CompositeStrategy.js';

const kiyohara = new KiyoharaStrategy();
const graham = new GrahamStrategy();
const buffett = new BuffettStrategy();
const lynch = new LynchStrategy();
const dividend = new DividendStrategy();
const composite = new CompositeStrategy([kiyohara, graham, buffett, lynch, dividend]);

export const strategies: InvestmentStrategy[] = [kiyohara, graham, buffett, lynch, dividend, composite];

export function getStrategy(id: string): InvestmentStrategy | undefined {
  return strategies.find(s => s.meta.id === id);
}

export function activeStrategies(): InvestmentStrategy[] {
  return strategies.filter(s => s.meta.active);
}

export type { InvestmentStrategy, StrategyId };
export type { StrategyMeta, StockMetrics, StrategyScore, RankingRow, RankingOpts } from './InvestmentStrategy.js';
