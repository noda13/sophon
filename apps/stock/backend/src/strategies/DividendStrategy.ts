import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy.js';
import { rankStocks, BILLION } from './rankStocks.js';

// Dividend / income proxy: J-Quants free tier lacks per-share dividend data.
// Uses earnings yield (profit / marketCap) as income proxy, combined with
// balance sheet stability.
export class DividendStrategy implements InvestmentStrategy {
  readonly meta: StrategyMeta = {
    id: 'dividend',
    displayName: '配当・インカム流',
    description: '益回り＋財務安定性によるインカム重視スクリーニング（配当データ代替）',
    active: true,
  };

  score(m: StockMetrics): StrategyScore {
    const components: Record<string, number | null> = {
      earningsYieldScore: null,
      stabilityBonus: null,
      pbrPenalty: null,
    };

    if (m.profit === null || m.profit <= 0 || m.marketCap <= 0) {
      return { score: 0, components, reason: m.profit !== null && m.profit <= 0 ? '赤字（インカム不適）' : 'データ不足' };
    }

    // Earnings yield = profit / marketCap (proxy for dividend capacity)
    const yield_ = m.profit / m.marketCap;
    let earningsYieldScore: number;
    if (yield_ >= 0.12) earningsYieldScore = 60;
    else if (yield_ >= 0.08) earningsYieldScore = 50;
    else if (yield_ >= 0.05) earningsYieldScore = 35;
    else if (yield_ >= 0.03) earningsYieldScore = 18;
    else earningsYieldScore = 5;
    components.earningsYieldScore = earningsYieldScore;

    // Balance sheet stability: positive NCR = no net debt = dividend capacity
    let stabilityBonus = 0;
    if (m.netCashRatio !== null && m.netCashRatio >= 0.5) stabilityBonus = 20;
    else if (m.netCashRatio !== null && m.netCashRatio >= 0) stabilityBonus = 12;
    // else 0 (null or negative NCR)
    components.stabilityBonus = stabilityBonus;

    // PBR penalty: income investors dislike paying excessive book premium
    const pbrPenalty = m.pbr !== null && m.pbr > 2 ? -10 : 0;
    components.pbrPenalty = pbrPenalty;

    const rawScore = earningsYieldScore + stabilityBonus + pbrPenalty;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    let judgment: string;
    if (score >= 65) judgment = '高インカム候補';
    else if (score >= 45) judgment = '良好';
    else if (score >= 25) judgment = '様子見';
    else judgment = '対象外';

    const yieldPct = (yield_ * 100).toFixed(2);
    const ncrStr = m.netCashRatio !== null ? `NCR=${m.netCashRatio.toFixed(2)}` : 'NCR=null';
    const pbrStr = m.pbr !== null ? `PBR=${m.pbr.toFixed(2)}` : 'PBR=n/a';
    const reason = `益回り${yieldPct}%, ${ncrStr}, ${pbrStr} → ${judgment}`;

    return { score, components, reason };
  }

  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[] {
    return rankStocks(this, stocks, opts, {
      defaultMaxMarketCap: 5000 * BILLION,
      eligible: s => s.profit !== null && s.profit > 0,
    });
  }
}
