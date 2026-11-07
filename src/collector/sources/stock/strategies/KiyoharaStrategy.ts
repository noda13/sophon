import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy';
import { rankStocks, BILLION } from '../rank';

export class KiyoharaStrategy implements InvestmentStrategy {
  readonly meta: StrategyMeta = {
    id: 'kiyohara',
    displayName: '清原流',
    description:
      'ネットキャッシュ比率とキャッシュニュートラルPERによる小型バリュー・コントラリアン視点',
    active: true,
  };

  score(m: StockMetrics): StrategyScore {
    const components: Record<string, number | null> = {
      ncrScore: null,
      cnperScore: null,
      sizeBonus: null,
    };

    let ncrScore: number;
    const ncr = m.netCashRatio;
    if (ncr === null) {
      ncrScore = 0;
    } else if (ncr >= 2.0) {
      ncrScore = 80;
    } else if (ncr >= 1.0) {
      ncrScore = 50 + (ncr - 1.0) * 30;
    } else if (ncr >= 0.5) {
      ncrScore = 25 + (ncr - 0.5) * 50;
    } else if (ncr >= 0) {
      ncrScore = 10 + ncr * 30;
    } else {
      ncrScore = Math.max(0, 10 + ncr * 5);
    }
    ncrScore = Math.round(ncrScore);
    components.ncrScore = ncrScore;

    let cnperScore = 0;
    const cnper = m.cashNeutralPer;
    if (cnper !== null) {
      if (cnper <= 5) {
        cnperScore = 20;
      } else if (cnper <= 10) {
        cnperScore = 15;
      } else if (cnper <= 15) {
        cnperScore = 8;
      } else if (cnper <= 20) {
        cnperScore = 0;
      } else if (cnper <= 40) {
        cnperScore = -8;
      } else {
        cnperScore = -15;
      }
    }
    components.cnperScore = cnperScore;

    let sizeBonus = 0;
    if (m.marketCap > 500 * BILLION) {
      sizeBonus = -10;
    } else if (m.marketCap <= 50 * BILLION) {
      sizeBonus = 5;
    } else if (m.marketCap <= 100 * BILLION) {
      sizeBonus = 3;
    }
    components.sizeBonus = sizeBonus;

    let rawScore = ncrScore + cnperScore + sizeBonus;

    if (m.profit !== null && m.profit <= 0) {
      rawScore = Math.min(rawScore, 50);
    }

    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    const ncrStr = ncr !== null ? `NCR=${ncr.toFixed(2)}` : 'NCR=null';
    const cnperStr = cnper !== null ? `CNPER=${cnper.toFixed(1)}` : 'CNPER=null';
    const marketCapBillion = (m.marketCap / BILLION).toFixed(0);
    let judgment: string;
    if (score >= 75) {
      judgment = '強い買い候補';
    } else if (score >= 55) {
      judgment = '買い候補';
    } else if (score >= 40) {
      judgment = '様子見';
    } else if (score >= 20) {
      judgment = '割高気味';
    } else {
      judgment = '対象外';
    }
    const sizeNote = m.marketCap > 500 * BILLION ? '大型株ペナルティ' : `${marketCapBillion}億円`;
    const redNote = m.profit !== null && m.profit <= 0 ? '、赤字キャップ' : '';

    const reason = `${ncrStr}, ${cnperStr}, ${sizeNote}${redNote} → ${judgment}`;

    return { score, components, reason };
  }

  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[] {
    return rankStocks(this, stocks, opts, {
      defaultMaxMarketCap: 500 * BILLION,
    });
  }
}
