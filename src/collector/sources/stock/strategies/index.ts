import type { InvestmentStrategy, StrategyId } from './InvestmentStrategy';
import { KiyoharaStrategy } from './KiyoharaStrategy';
import { GrahamStrategy } from './GrahamStrategy';
import { BuffettStrategy } from './BuffettStrategy';
import { LynchStrategy } from './LynchStrategy';
import { DividendStrategy } from './DividendStrategy';
import { CompositeStrategy } from './CompositeStrategy';

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
export type { StrategyMeta, StockMetrics, StrategyScore, RankingRow, RankingOpts } from './InvestmentStrategy';
