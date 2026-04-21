import type {
  InvestmentStrategy,
  StrategyMeta,
  StockMetrics,
  StrategyScore,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy.js';

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

    // --- NCR score (0-70 base) ---
    let ncrScore: number;
    const ncr = m.netCashRatio;
    if (ncr >= 2.0) {
      ncrScore = 80;
    } else if (ncr >= 1.0) {
      // linear from 50 to 80 between 1.0 and 2.0
      ncrScore = 50 + (ncr - 1.0) * 30;
    } else if (ncr >= 0.5) {
      // linear from 25 to 50 between 0.5 and 1.0
      ncrScore = 25 + (ncr - 0.5) * 50;
    } else if (ncr >= 0) {
      // linear from 10 to 25 between 0 and 0.5
      ncrScore = 10 + ncr * 30;
    } else {
      // negative NCR: up to 10
      ncrScore = Math.max(0, 10 + ncr * 5);
    }
    components.ncrScore = Math.round(ncrScore);

    // --- CNPER score adjustment (-15 to +20) ---
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

    // --- Size bonus (small cap preferred) ---
    const BILLION = 100_000_000; // 1億
    let sizeBonus = 0;
    if (m.marketCap > 500 * BILLION) {
      sizeBonus = -10;
    } else if (m.marketCap <= 50 * BILLION) {
      sizeBonus = 5;
    } else if (m.marketCap <= 100 * BILLION) {
      sizeBonus = 3;
    }
    components.sizeBonus = sizeBonus;

    // --- Combine ---
    let rawScore = ncrScore + cnperScore + sizeBonus;

    // Red flag: loss-making cap at 50
    if (m.profit !== null && m.profit <= 0) {
      rawScore = Math.min(rawScore, 50);
    }

    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // --- Reason string ---
    const ncrStr = `NCR=${ncr.toFixed(2)}`;
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
    const BILLION = 100_000_000;
    const limit = opts?.limit ?? 50;
    const maxMarketCap = opts?.maxMarketCap ?? 500 * BILLION;
    const minMarketCap = opts?.minMarketCap ?? 0;
    const excludeSectors = opts?.excludeSectors ?? [];

    const now = new Date().toISOString();

    const filtered = stocks.filter(s => {
      if (s.marketCap > maxMarketCap) return false;
      if (s.marketCap < minMarketCap) return false;
      if (excludeSectors.length > 0 && s.sector33Name && excludeSectors.includes(s.sector33Name)) {
        return false;
      }
      return true;
    });

    const scored = filtered.map(s => ({
      ...s,
      rank: 0,
      strategyScore: this.score(s),
      snapshotAt: now,
    }));

    scored.sort((a, b) => b.strategyScore.score - a.strategyScore.score);

    return scored.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
  }
}
