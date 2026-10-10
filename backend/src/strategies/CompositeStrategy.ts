import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy.js';
import { rankStocks, BILLION } from './rankStocks.js';

// Equal-weight average of all constituent strategies.
export class CompositeStrategy implements InvestmentStrategy {
  readonly meta: StrategyMeta = {
    id: 'composite',
    displayName: '総合スコア',
    description: '清原流・グレアム流・バフェット流・リンチ流・配当流の5視点均等合算',
    active: true,
  };

  constructor(private readonly constituents: InvestmentStrategy[]) {}

  score(m: StockMetrics): StrategyScore {
    const components: Record<string, number | null> = {};

    if (this.constituents.length === 0) {
      return { score: 0, components, reason: '構成戦略なし' };
    }

    let total = 0;

    for (const s of this.constituents) {
      const result = s.score(m);
      components[s.meta.id] = result.score;
      total += result.score;
    }

    const score = Math.max(0, Math.min(100, Math.round(total / this.constituents.length)));

    const parts = this.constituents
      .map(s => `${s.meta.displayName}:${components[s.meta.id]}`)
      .join(', ');
    const reason = `総合(均等加重): ${parts}`;

    return { score, components, reason };
  }

  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[] {
    return rankStocks(this, stocks, opts, {
      defaultMaxMarketCap: 5000 * BILLION,
    });
  }
}
