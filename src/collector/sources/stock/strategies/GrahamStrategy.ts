import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy';
import { rankStocks, BILLION } from '../rank';

export class GrahamStrategy implements InvestmentStrategy {
  readonly meta: StrategyMeta = {
    id: 'graham',
    displayName: 'グレアム流',
    description: 'PBR×PER≤22.5のグレアム数値基準による割安バリュー投資',
    active: true,
  };

  score(m: StockMetrics): StrategyScore {
    const components: Record<string, number | null> = {
      grahamProductScore: null,
      pbrScore: null,
      perScore: null,
      ncrBonus: null,
    };

    if (m.per === null || m.pbr === null) {
      return { score: 0, components, reason: 'データ不足（PER/PBRが必要）' };
    }

    const gp = m.pbr * m.per;
    let grahamProductScore: number;
    if (gp <= 11) {
      grahamProductScore = 50;
    } else if (gp <= 22.5) {
      grahamProductScore = 25 + ((22.5 - gp) / 11.5) * 25;
    } else if (gp <= 45) {
      grahamProductScore = Math.max(0, 25 - (gp - 22.5) * 0.55);
    } else {
      grahamProductScore = 0;
    }
    grahamProductScore = Math.round(grahamProductScore);
    components.grahamProductScore = grahamProductScore;

    let pbrScore: number;
    if (m.pbr <= 0.5) pbrScore = 25;
    else if (m.pbr <= 1.0) pbrScore = 20;
    else if (m.pbr <= 1.5) pbrScore = 12;
    else if (m.pbr <= 2.0) pbrScore = 5;
    else pbrScore = 0;
    components.pbrScore = pbrScore;

    let perScore: number;
    if (m.per <= 7) perScore = 25;
    else if (m.per <= 10) perScore = 20;
    else if (m.per <= 15) perScore = 12;
    else if (m.per <= 20) perScore = 5;
    else perScore = 0;
    components.perScore = perScore;

    const ncrBonus = m.netCashRatio !== null && m.netCashRatio >= 0 ? 5 : 0;
    components.ncrBonus = ncrBonus;

    let rawScore = grahamProductScore + pbrScore + perScore + ncrBonus;
    if (m.profit !== null && m.profit <= 0) rawScore = Math.min(rawScore, 30);

    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    let judgment: string;
    if (score >= 70) judgment = '強い買い候補';
    else if (score >= 50) judgment = '買い候補';
    else if (score >= 30) judgment = '様子見';
    else judgment = '対象外';

    const redNote = m.profit !== null && m.profit <= 0 ? '、赤字キャップ' : '';
    const reason = `PBR×PER=${gp.toFixed(1)}, PBR=${m.pbr.toFixed(2)}, PER=${m.per.toFixed(1)}${redNote} → ${judgment}`;

    return { score, components, reason };
  }

  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[] {
    return rankStocks(this, stocks, opts, {
      defaultMaxMarketCap: 2000 * BILLION,
      eligible: s => s.per !== null && s.pbr !== null,
    });
  }
}
