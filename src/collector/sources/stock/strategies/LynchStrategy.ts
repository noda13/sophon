import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy';
import { rankStocks, BILLION } from '../rank';

// Multi-period growth is not collected, so low PER stands in for "growth at a reasonable price".
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

    let perScore: number;
    if (m.per <= 5) perScore = 60;
    else if (m.per <= 10) perScore = 50;
    else if (m.per <= 15) perScore = 38;
    else if (m.per <= 20) perScore = 22;
    else if (m.per <= 30) perScore = 8;
    else perScore = 0;
    components.perScore = perScore;

    const BILLION = 100_000_000;
    let sizeBonus = 0;
    if (m.marketCap <= 30 * BILLION) sizeBonus = 15;
    else if (m.marketCap <= 100 * BILLION) sizeBonus = 10;
    else if (m.marketCap <= 300 * BILLION) sizeBonus = 4;
    components.sizeBonus = sizeBonus;

    const pbrPenalty = m.pbr !== null && m.pbr > 3 ? -8 : 0;
    components.pbrPenalty = pbrPenalty;

    const rawScore = perScore + sizeBonus + pbrPenalty;

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
    return rankStocks(this, stocks, opts, {
      defaultMaxMarketCap: 1000 * BILLION,
      eligible: s => s.per !== null,
    });
  }
}
