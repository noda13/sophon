import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy.js';

// Lynch's GARP (Growth at Reasonable Price) — approximated without multi-period growth data.
// Proxy: low PER + profitable + small/mid-cap as under-coverage bonus.
export class LynchStrategy implements InvestmentStrategy {
  readonly meta: StrategyMeta = {
    id: 'lynch',
    displayName: 'リンチ流',
    description: '低PER・収益成長重視のGARPスタイル（成長率の代理として低PER＋中小型を重視）',
    active: true,
  };

  score(m: StockMetrics): StrategyScore {
    const components: Record<string, number | null> = {
      perScore: null,
      sizeBonus: null,
      pbrPenalty: null,
    };

    if (m.per === null) {
      return { score: 0, components, reason: 'データ不足（PERが必要）' };
    }

    // PER score: Lynch liked buying growth at PER below its growth rate.
    // Without growth rate data, treat low PER directly as the primary signal.
    let perScore: number;
    if (m.per <= 5) perScore = 60;
    else if (m.per <= 10) perScore = 50;
    else if (m.per <= 15) perScore = 38;
    else if (m.per <= 20) perScore = 22;
    else if (m.per <= 30) perScore = 8;
    else perScore = 0;
    components.perScore = perScore;

    // Small/mid-cap bonus: Lynch found multi-baggers among under-covered companies
    const BILLION = 100_000_000;
    let sizeBonus = 0;
    if (m.marketCap <= 30 * BILLION) sizeBonus = 15;
    else if (m.marketCap <= 100 * BILLION) sizeBonus = 10;
    else if (m.marketCap <= 300 * BILLION) sizeBonus = 4;
    components.sizeBonus = sizeBonus;

    // PBR penalty: paying too much book value undermines GARP thesis
    const pbrPenalty = m.pbr !== null && m.pbr > 3 ? -8 : 0;
    components.pbrPenalty = pbrPenalty;

    let rawScore = perScore + sizeBonus + pbrPenalty;
    if (m.profit !== null && m.profit <= 0) rawScore = Math.min(rawScore, 20);

    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    const marketCapBillion = (m.marketCap / BILLION).toFixed(0);
    let judgment: string;
    if (score >= 65) judgment = '有望候補';
    else if (score >= 45) judgment = '注目';
    else if (score >= 25) judgment = '様子見';
    else judgment = '対象外';

    const redNote = m.profit !== null && m.profit <= 0 ? '、赤字キャップ' : '';
    const reason = `PER=${m.per.toFixed(1)}, 時価総額${marketCapBillion}億${redNote} → ${judgment}`;

    return { score, components, reason };
  }

  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[] {
    const BILLION = 100_000_000;
    const limit = opts?.limit ?? 50;
    const maxMarketCap = opts?.maxMarketCap ?? 1000 * BILLION;
    const minMarketCap = opts?.minMarketCap ?? 0;
    const excludeSectors = opts?.excludeSectors ?? [];
    const now = new Date().toISOString();

    const filtered = stocks.filter(s => {
      if (s.marketCap > maxMarketCap || s.marketCap < minMarketCap) return false;
      if (s.per === null) return false;
      if (excludeSectors.length > 0 && s.sector33Name && excludeSectors.includes(s.sector33Name)) return false;
      return true;
    });

    const scored = filtered.map(s => ({ ...s, rank: 0, strategyScore: this.score(s), snapshotAt: now }));
    scored.sort((a, b) => b.strategyScore.score - a.strategyScore.score);
    return scored.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
  }
}
