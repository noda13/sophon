import { describe, it, expect } from 'vitest';
import { computeNetCash, computeMetrics } from '../metricCalculator.js';

describe('computeNetCash', () => {
  it('returns null when currentAssets is null', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: null, totalAssets: 500, equity: 300, profit: null })).toBeNull();
  });

  it('returns null when totalAssets is null', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: null, equity: 300, profit: null })).toBeNull();
  });

  it('returns null when equity is null', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: null, profit: null })).toBeNull();
  });

  it('returns null when all balance-sheet fields are null (missing data scenario)', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: null })).toBeNull();
  });

  it('computes correctly when all fields are present', () => {
    // NetCash = currentAssets + investSec*0.7 - (totalAssets - equity)
    // = 200 + 0 - (500 - 300) = 200 - 200 = 0
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, profit: null })).toBe(0);
  });

  it('handles positive net cash', () => {
    // = 400 - (500 - 300) = 400 - 200 = 200
    expect(computeNetCash({ marketCap: 1000, currentAssets: 400, totalAssets: 500, equity: 300, profit: null })).toBe(200);
  });

  it('handles negative net cash (net debt)', () => {
    // = 100 - (500 - 300) = 100 - 200 = -100
    expect(computeNetCash({ marketCap: 1000, currentAssets: 100, totalAssets: 500, equity: 300, profit: null })).toBe(-100);
  });

  it('includes investmentSecurities at 70%', () => {
    // = 200 + 100*0.7 - (500-300) = 200 + 70 - 200 = 70
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, investmentSecurities: 100, profit: null })).toBe(70);
  });
});

describe('computeMetrics', () => {
  it('netCashRatio is null when balance-sheet data is missing', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: null });
    expect(result.netCash).toBeNull();
    expect(result.netCashRatio).toBeNull();
  });

  it('netCashRatio is null when marketCap is 0', () => {
    const result = computeMetrics({ marketCap: 0, currentAssets: 200, totalAssets: 500, equity: 300, profit: null });
    expect(result.netCashRatio).toBeNull();
  });

  it('netCashRatio is computed correctly when data is present', () => {
    // netCash = 200 - 200 = 0, netCashRatio = 0/1000 = 0
    const result = computeMetrics({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, profit: null });
    expect(result.netCashRatio).toBe(0);
  });

  it('cashNeutralPer is null when netCash is null', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: 100 });
    expect(result.cashNeutralPer).toBeNull();
  });

  it('per is null for loss-making companies', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, profit: -50 });
    expect(result.per).toBeNull();
  });

  it('pbr is null when equity is null or zero', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: null });
    expect(result.pbr).toBeNull();
  });
});
