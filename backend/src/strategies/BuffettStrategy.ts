import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy.js';

export class BuffettStrategy implements InvestmentStrategy {
  readonly meta: StrategyMeta = {
    id: 'buffett',
    displayName: 'バフェット流',
    description: '高ROE・低負債・安定利益による優良企業スクリーニング',
    active: true,
  };

  score(m: StockMetrics): StrategyScore {
    const components: Record<string, number | null> = {
      roeScore: null,
      qualityBonus: null,
      valuationPenalty: null,
    };

    if (m.equity === null || m.equity <= 0) {
      return { score: 0, components, reason: 'データ不足（純資産が必要）' };
    }

    // ROE = profit / equity (main driver, 0–60 pts)
    let roeScore = 0;
    if (m.profit !== null && m.profit > 0) {
      const roe = m.profit / m.equity;
      if (roe >= 0.30) roeScore = 60;
      else if (roe >= 0.20) roeScore = 50;
      else if (roe >= 0.15) roeScore = 40;
      else if (roe >= 0.10) roeScore = 25;
      else if (roe >= 0.05) roeScore = 10;
      else roeScore = 0;
    }
    components.roeScore = roeScore;

    // Financial quality bonus: NCR ≥ 0 means no net debt (+15)
    const qualityBonus = m.netCashRatio >= 0 ? 15 : 0;
    components.qualityBonus = qualityBonus;

    // Valuation penalty: PBR > 5 is dangerously expensive (-10)
    const valuationPenalty = m.pbr !== null && m.pbr > 5 ? -10 : 0;
    components.valuationPenalty = valuationPenalty;

    let rawScore = roeScore + qualityBonus + valuationPenalty;
    if (m.profit !== null && m.profit <= 0) rawScore = Math.min(rawScore, 20);

    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    const roe = m.profit !== null && m.profit > 0 ? ((m.profit / m.equity) * 100).toFixed(1) : null;
    const roeStr = roe !== null ? `ROE=${roe}%` : 'ROE=n/a';
    const pbrStr = m.pbr !== null ? `PBR=${m.pbr.toFixed(2)}` : 'PBR=n/a';

    let judgment: string;
    if (score >= 65) judgment = '優良候補';
    else if (score >= 45) judgment = '良好';
    else if (score >= 25) judgment = '様子見';
    else judgment = '対象外';

    const redNote = m.profit !== null && m.profit <= 0 ? '、赤字キャップ' : '';
    const reason = `${roeStr}, ${pbrStr}${redNote} → ${judgment}`;

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
      if (s.equity === null || s.equity <= 0) return false;
      if (excludeSectors.length > 0 && s.sector33Name && excludeSectors.includes(s.sector33Name)) return false;
      return true;
    });

    const scored = filtered.map(s => ({ ...s, rank: 0, strategyScore: this.score(s), snapshotAt: now }));
    scored.sort((a, b) => b.strategyScore.score - a.strategyScore.score);
    return scored.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
  }
}
