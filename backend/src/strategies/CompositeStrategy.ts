import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy.js';

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
    const BILLION = 100_000_000;
    const limit = opts?.limit ?? 50;
    const maxMarketCap = opts?.maxMarketCap ?? 5000 * BILLION;
    const minMarketCap = opts?.minMarketCap ?? 0;
    const excludeSectors = opts?.excludeSectors ?? [];
    const now = new Date().toISOString();

    const filtered = stocks.filter(s => {
      if (s.marketCap > maxMarketCap || s.marketCap < minMarketCap) return false;
      if (excludeSectors.length > 0 && s.sector33Name && excludeSectors.includes(s.sector33Name)) return false;
      return true;
    });

    const scored = filtered.map(s => ({ ...s, rank: 0, strategyScore: this.score(s), snapshotAt: now }));
    scored.sort((a, b) => b.strategyScore.score - a.strategyScore.score);
    return scored.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
  }
}
