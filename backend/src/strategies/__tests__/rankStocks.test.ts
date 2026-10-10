import { describe, it, expect } from 'vitest';
import { rankStocks, BILLION } from '../rankStocks.js';
import type { StockMetrics, StrategyScore } from '../InvestmentStrategy.js';

function makeMetrics(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    code: '1000',
    name: 'テスト',
    sector33Name: null,
    marketSegment: null,
    marketCap: 100 * BILLION,
    netCash: null,
    netCashRatio: null,
    cashNeutralPer: null,
    per: null,
    pbr: null,
    profit: null,
    equity: null,
    ...overrides,
  };
}

const byPer = {
  score: (m: StockMetrics): StrategyScore => ({ score: m.per ?? 0, components: {}, reason: '' }),
};
const config = { defaultMaxMarketCap: 1000 * BILLION };

describe('rankStocks', () => {
  it('returns empty array for empty input', () => {
    expect(rankStocks(byPer, [], undefined, config)).toEqual([]);
  });

  it('sorts by score descending and assigns 1-based ranks', () => {
    const rows = rankStocks(
      byPer,
      [makeMetrics({ code: 'a', per: 10 }), makeMetrics({ code: 'b', per: 30 }), makeMetrics({ code: 'c', per: 20 })],
      undefined,
      config,
    );
    expect(rows.map(r => [r.code, r.rank])).toEqual([['b', 1], ['c', 2], ['a', 3]]);
  });

  it('keeps input order for tied scores', () => {
    const rows = rankStocks(
      byPer,
      [makeMetrics({ code: 'a', per: 10 }), makeMetrics({ code: 'b', per: 10 }), makeMetrics({ code: 'c', per: 10 })],
      undefined,
      config,
    );
    expect(rows.map(r => r.code)).toEqual(['a', 'b', 'c']);
    expect(rows.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it('applies limit', () => {
    const stocks = [1, 2, 3, 4].map(n => makeMetrics({ code: String(n), per: n }));
    expect(rankStocks(byPer, stocks, { limit: 2 }, config).map(r => r.code)).toEqual(['4', '3']);
  });

  it('defaults limit to 50', () => {
    const stocks = Array.from({ length: 60 }, (_, i) => makeMetrics({ code: String(i), per: i }));
    expect(rankStocks(byPer, stocks, undefined, config)).toHaveLength(50);
  });

  it('filters by default and overridden market cap bounds', () => {
    const stocks = [
      makeMetrics({ code: 'small', per: 1, marketCap: 10 * BILLION }),
      makeMetrics({ code: 'mid', per: 2, marketCap: 500 * BILLION }),
      makeMetrics({ code: 'big', per: 3, marketCap: 2000 * BILLION }),
    ];
    expect(rankStocks(byPer, stocks, undefined, config).map(r => r.code)).toEqual(['mid', 'small']);
    expect(rankStocks(byPer, stocks, { maxMarketCap: 3000 * BILLION }, config).map(r => r.code)).toEqual([
      'big',
      'mid',
      'small',
    ]);
    expect(rankStocks(byPer, stocks, { minMarketCap: 100 * BILLION }, config).map(r => r.code)).toEqual(['mid']);
  });

  it('excludes listed sectors but keeps stocks without a sector', () => {
    const stocks = [
      makeMetrics({ code: 'a', per: 1, sector33Name: '銀行業' }),
      makeMetrics({ code: 'b', per: 2, sector33Name: '食料品' }),
      makeMetrics({ code: 'c', per: 3, sector33Name: null }),
    ];
    const rows = rankStocks(byPer, stocks, { excludeSectors: ['銀行業'] }, config);
    expect(rows.map(r => r.code)).toEqual(['c', 'b']);
  });

  it('drops stocks rejected by eligible and returns empty when all are filtered out', () => {
    const stocks = [makeMetrics({ code: 'a', per: null }), makeMetrics({ code: 'b', per: 5 })];
    const eligible = (s: StockMetrics) => s.per !== null;
    expect(rankStocks(byPer, stocks, undefined, { ...config, eligible }).map(r => r.code)).toEqual(['b']);
    expect(rankStocks(byPer, [stocks[0]], undefined, { ...config, eligible })).toEqual([]);
  });

  it('attaches strategyScore and a shared snapshotAt', () => {
    const rows = rankStocks(byPer, [makeMetrics({ per: 7 }), makeMetrics({ per: 8 })], undefined, config);
    expect(rows[0].strategyScore.score).toBe(8);
    expect(rows[0].snapshotAt).toBe(rows[1].snapshotAt);
  });
});
