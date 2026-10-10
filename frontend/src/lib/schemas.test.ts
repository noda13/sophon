import { describe, expect, it } from 'vitest';
import {
  RankingRowSchema,
  StaticStockDetailSchema,
  StrategyMetaSchema,
} from './schemas';

const score = { score: 80, components: { ncr: 60, per: null }, reason: 'r' };

const row = {
  code: '1234',
  name: 'テスト',
  sector33Name: null,
  marketSegment: 'Growth',
  marketCap: 1_000_000_000,
  netCash: null,
  netCashRatio: 1.2,
  cashNeutralPer: null,
  per: 8,
  pbr: null,
  profit: 100,
  equity: 500,
  rank: 1,
  strategyScore: score,
  snapshotAt: '2026-01-01T00:00:00Z',
};

describe('StrategyMetaSchema', () => {
  it('accepts a known strategy id', () => {
    expect(
      StrategyMetaSchema.safeParse({ id: 'graham', displayName: 'g', description: '', active: false }).success,
    ).toBe(true);
  });

  it('rejects an unknown strategy id', () => {
    expect(
      StrategyMetaSchema.safeParse({ id: 'nope', displayName: 'g', description: '', active: false }).success,
    ).toBe(false);
  });
});

describe('RankingRowSchema', () => {
  it('accepts a valid row with nullable metrics', () => {
    expect(RankingRowSchema.parse(row).code).toBe('1234');
  });

  it('rejects a row with a string marketCap', () => {
    expect(RankingRowSchema.safeParse({ ...row, marketCap: '1' }).success).toBe(false);
  });

  it('rejects a row missing strategyScore', () => {
    const { strategyScore: _omit, ...rest } = row;
    expect(RankingRowSchema.safeParse(rest).success).toBe(false);
  });
});

describe('StaticStockDetailSchema', () => {
  const statement = {
    id: 's1',
    code: '1234',
    fiscalYear: 2025,
    typeOfCurrentPeriod: 'FY',
    disclosedDate: '2026-02-01',
    periodEndDate: '2025-12-31',
    netSales: 1,
    operatingProfit: null,
    ordinaryProfit: null,
    profit: 1,
    totalAssets: 1,
    equity: 1,
    cashAndEquivalents: 1,
    sharesOutstanding: null,
  };
  const detail = {
    profile: {
      code: '1234',
      name: 'テスト',
      sector33Name: null,
      sector33Code: null,
      sector17Code: null,
      marketSegment: null,
      scaleCategory: null,
      updatedAt: '2026-01-01',
      snapshots: [],
    },
    history: [statement],
    strategies: { kiyohara: score },
  };

  it('accepts a valid detail payload', () => {
    expect(StaticStockDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('rejects a history entry with a non-numeric fiscalYear', () => {
    const bad = { ...detail, history: [{ ...statement, fiscalYear: '2025' }] };
    expect(StaticStockDetailSchema.safeParse(bad).success).toBe(false);
  });
});
