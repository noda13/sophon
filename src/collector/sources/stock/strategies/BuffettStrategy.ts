import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy';
import { rankStocks, BILLION } from '../rank';

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

    const qualityBonus = m.netCashRatio !== null && m.netCashRatio >= 0 ? 15 : 0;
    components.qualityBonus = qualityBonus;

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
    return rankStocks(this, stocks, opts, {
      defaultMaxMarketCap: 5000 * BILLION,
      eligible: s => s.equity !== null && s.equity > 0,
    });
  }
}
