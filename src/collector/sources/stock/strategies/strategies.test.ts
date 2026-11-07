import { describe, it, expect } from 'vitest';
import { KiyoharaStrategy } from './KiyoharaStrategy';
import { GrahamStrategy } from './GrahamStrategy';
import { BuffettStrategy } from './BuffettStrategy';
import { LynchStrategy } from './LynchStrategy';
import { DividendStrategy } from './DividendStrategy';
import { CompositeStrategy } from './CompositeStrategy';
import type { StockMetrics } from './InvestmentStrategy';

const BILLION = 100_000_000;

function makeMetrics(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    code: '1234',
    name: 'テスト株式会社',
    sector33Name: null,
    marketSegment: null,
    marketCap: 10_000 * BILLION, // 1兆円
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

// ─── KiyoharaStrategy ───────────────────────────────────────────────────────

describe('KiyoharaStrategy', () => {
  const strategy = new KiyoharaStrategy();

  it('null netCashRatio → ncrScore=0', () => {
    const m = makeMetrics({ netCashRatio: null });
    const result = strategy.score(m);
    expect(result.components.ncrScore).toBe(0);
  });

  it('null netCashRatio with large marketCap → score includes only large-cap penalty (sizeBonus=-10) + ncrScore=0', () => {
    // marketCap=1兆: sizeBonus=-10, ncrScore=0, cnperScore=0 → rawScore=-10 → clamped to 0
    const m = makeMetrics({ netCashRatio: null, marketCap: 1_000 * BILLION });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('null netCashRatio with small marketCap → score = sizeBonus(5) only = 5', () => {
    // marketCap=30億: sizeBonus=5, ncrScore=0, cnperScore=0 → rawScore=5 → score=5
    const m = makeMetrics({ netCashRatio: null, marketCap: 30 * BILLION });
    const result = strategy.score(m);
    expect(result.score).toBe(5);
  });

  it('NCR=0.5 → ncrScore=25 (linear boundary)', () => {
    const m = makeMetrics({ netCashRatio: 0.5, marketCap: 200 * BILLION });
    const result = strategy.score(m);
    // ncr=0.5: ncrScore = 25 + (0.5-0.5)*50 = 25
    expect(result.components.ncrScore).toBe(25);
  });

  it('NCR=1.0 → ncrScore=50', () => {
    const m = makeMetrics({ netCashRatio: 1.0, marketCap: 200 * BILLION });
    const result = strategy.score(m);
    // ncr=1.0: ncrScore = 50 + (1.0-1.0)*30 = 50
    expect(result.components.ncrScore).toBe(50);
  });

  it('NCR>=2.0 → ncrScore=80', () => {
    const m = makeMetrics({ netCashRatio: 2.5, marketCap: 200 * BILLION });
    const result = strategy.score(m);
    expect(result.components.ncrScore).toBe(80);
  });

  it('NCR=0 → ncrScore=10', () => {
    const m = makeMetrics({ netCashRatio: 0, marketCap: 200 * BILLION });
    const result = strategy.score(m);
    // ncr=0 in [0, 0.5): ncrScore = 10 + 0*30 = 10
    expect(result.components.ncrScore).toBe(10);
  });

  it('negative NCR → ncrScore clipped at 0 when very negative', () => {
    const m = makeMetrics({ netCashRatio: -5, marketCap: 200 * BILLION });
    const result = strategy.score(m);
    // ncrScore = max(0, 10 + (-5)*5) = max(0, -15) = 0
    expect(result.components.ncrScore).toBe(0);
  });
});

// ─── GrahamStrategy ─────────────────────────────────────────────────────────

describe('GrahamStrategy', () => {
  const strategy = new GrahamStrategy();

  it('null per → score=0 (data insufficient)', () => {
    const m = makeMetrics({ per: null, pbr: 1.0 });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('null pbr → score=0 (data insufficient)', () => {
    const m = makeMetrics({ per: 10, pbr: null });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('null netCashRatio → ncrBonus=0 even when per/pbr are valid', () => {
    // per=10, pbr=1.0 → gp=10 (<=11 → grahamProductScore=50)
    // pbrScore: pbr=1.0 → 20; perScore: per=10 → 20; ncrBonus=0
    const m = makeMetrics({ per: 10, pbr: 1.0, netCashRatio: null });
    const result = strategy.score(m);
    expect(result.components.ncrBonus).toBe(0);
    // total = 50 + 20 + 20 + 0 = 90 → clamped to 90
    expect(result.score).toBe(90);
  });

  it('netCashRatio >= 0 → ncrBonus=5', () => {
    const m = makeMetrics({ per: 10, pbr: 1.0, netCashRatio: 0 });
    const result = strategy.score(m);
    expect(result.components.ncrBonus).toBe(5);
    // 50 + 20 + 20 + 5 = 95
    expect(result.score).toBe(95);
  });

  it('positive netCashRatio → ncrBonus=5', () => {
    const m = makeMetrics({ per: 10, pbr: 1.0, netCashRatio: 0.5 });
    const result = strategy.score(m);
    expect(result.components.ncrBonus).toBe(5);
  });

  it('negative netCashRatio → ncrBonus=0', () => {
    const m = makeMetrics({ per: 10, pbr: 1.0, netCashRatio: -0.1 });
    const result = strategy.score(m);
    expect(result.components.ncrBonus).toBe(0);
  });

  it('high gp product → grahamProductScore=0', () => {
    // per=50, pbr=3.0 → gp=150 (>45) → grahamProductScore=0
    const m = makeMetrics({ per: 50, pbr: 3.0, netCashRatio: null });
    const result = strategy.score(m);
    expect(result.components.grahamProductScore).toBe(0);
  });

  it('loss-making company capped at 30', () => {
    const m = makeMetrics({ per: 10, pbr: 0.5, netCashRatio: 0, profit: -100 });
    const result = strategy.score(m);
    expect(result.score).toBeLessThanOrEqual(30);
  });
});

// ─── BuffettStrategy ─────────────────────────────────────────────────────────

describe('BuffettStrategy', () => {
  const strategy = new BuffettStrategy();

  it('null equity → score=0 (data insufficient)', () => {
    const m = makeMetrics({ equity: null });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('zero equity → score=0 (data insufficient)', () => {
    const m = makeMetrics({ equity: 0 });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('null netCashRatio → qualityBonus=0', () => {
    const m = makeMetrics({ equity: 1_000 * BILLION, netCashRatio: null, profit: 200 * BILLION });
    const result = strategy.score(m);
    expect(result.components.qualityBonus).toBe(0);
  });

  it('netCashRatio >= 0 → qualityBonus=15', () => {
    const m = makeMetrics({ equity: 1_000 * BILLION, netCashRatio: 0, profit: 200 * BILLION });
    const result = strategy.score(m);
    expect(result.components.qualityBonus).toBe(15);
  });

  it('high ROE + null netCashRatio → score = roeScore only (no quality bonus)', () => {
    // ROE = profit/equity = 200/1000 = 0.20 → roeScore=50
    // qualityBonus=0 (null NCR), valuationPenalty=0 (pbr=null)
    const m = makeMetrics({
      equity: 1_000 * BILLION,
      profit: 200 * BILLION,
      netCashRatio: null,
      pbr: null,
    });
    const result = strategy.score(m);
    expect(result.components.roeScore).toBe(50);
    expect(result.components.qualityBonus).toBe(0);
    expect(result.score).toBe(50);
  });

  it('high ROE + non-null netCashRatio >= 0 → score = roeScore + qualityBonus', () => {
    // ROE=0.20 → roeScore=50; qualityBonus=15; total=65
    const m = makeMetrics({
      equity: 1_000 * BILLION,
      profit: 200 * BILLION,
      netCashRatio: 0.3,
      pbr: null,
    });
    const result = strategy.score(m);
    expect(result.score).toBe(65);
  });

  it('PBR > 5 → valuationPenalty=-10', () => {
    const m = makeMetrics({ equity: 1_000 * BILLION, profit: 200 * BILLION, netCashRatio: null, pbr: 6 });
    const result = strategy.score(m);
    expect(result.components.valuationPenalty).toBe(-10);
  });

  it('PBR <= 5 → no valuation penalty', () => {
    const m = makeMetrics({ equity: 1_000 * BILLION, profit: 200 * BILLION, netCashRatio: null, pbr: 5 });
    const result = strategy.score(m);
    expect(result.components.valuationPenalty).toBe(0);
  });

  it('ROE >= 30% → roeScore=60', () => {
    // ROE = 300/1000 = 0.30 → roeScore=60
    const m = makeMetrics({ equity: 1_000 * BILLION, profit: 300 * BILLION, netCashRatio: null });
    const result = strategy.score(m);
    expect(result.components.roeScore).toBe(60);
  });

  it('loss-making company capped at 20', () => {
    const m = makeMetrics({ equity: 1_000 * BILLION, profit: -100 * BILLION, netCashRatio: 1.0 });
    const result = strategy.score(m);
    expect(result.score).toBeLessThanOrEqual(20);
  });
});

// ─── LynchStrategy ──────────────────────────────────────────────────────────

describe('LynchStrategy', () => {
  const strategy = new LynchStrategy();

  it('null per → score=0 (data insufficient)', () => {
    const m = makeMetrics({ per: null });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('low per + small cap → high score', () => {
    // per=10 → perScore=50; marketCap=20億 → sizeBonus=15; pbrPenalty=0 (pbr=null)
    // total=65
    const m = makeMetrics({ per: 10, marketCap: 20 * BILLION, pbr: null });
    const result = strategy.score(m);
    expect(result.components.perScore).toBe(50);
    expect(result.components.sizeBonus).toBe(15);
    expect(result.score).toBe(65);
  });

  it('per <= 5 → perScore=60', () => {
    const m = makeMetrics({ per: 5, marketCap: 500 * BILLION, pbr: null });
    const result = strategy.score(m);
    expect(result.components.perScore).toBe(60);
  });

  it('per > 30 → perScore=0', () => {
    const m = makeMetrics({ per: 50, marketCap: 500 * BILLION, pbr: null });
    const result = strategy.score(m);
    expect(result.components.perScore).toBe(0);
  });

  it('marketCap <= 30億 → sizeBonus=15', () => {
    const m = makeMetrics({ per: 15, marketCap: 30 * BILLION, pbr: null });
    const result = strategy.score(m);
    expect(result.components.sizeBonus).toBe(15);
  });

  it('marketCap <= 100億 → sizeBonus=10', () => {
    const m = makeMetrics({ per: 15, marketCap: 100 * BILLION, pbr: null });
    const result = strategy.score(m);
    expect(result.components.sizeBonus).toBe(10);
  });

  it('marketCap > 300億 → sizeBonus=0', () => {
    const m = makeMetrics({ per: 15, marketCap: 400 * BILLION, pbr: null });
    const result = strategy.score(m);
    expect(result.components.sizeBonus).toBe(0);
  });

  it('PBR > 3 → pbrPenalty=-8', () => {
    const m = makeMetrics({ per: 10, marketCap: 20 * BILLION, pbr: 4 });
    const result = strategy.score(m);
    expect(result.components.pbrPenalty).toBe(-8);
    // 50 + 15 - 8 = 57
    expect(result.score).toBe(57);
  });
});

// ─── DividendStrategy ───────────────────────────────────────────────────────

describe('DividendStrategy', () => {
  const strategy = new DividendStrategy();

  it('null profit → score=0', () => {
    const m = makeMetrics({ profit: null });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('negative profit → score=0', () => {
    const m = makeMetrics({ profit: -100 });
    const result = strategy.score(m);
    expect(result.score).toBe(0);
  });

  it('null netCashRatio → stabilityBonus=0', () => {
    // earnings yield = 100億/1兆 = 0.01 → earningsYieldScore=5
    const m = makeMetrics({
      profit: 100 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: null,
    });
    const result = strategy.score(m);
    expect(result.components.stabilityBonus).toBe(0);
  });

  it('netCashRatio >= 0.5 → stabilityBonus=20', () => {
    const m = makeMetrics({
      profit: 100 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: 0.5,
    });
    const result = strategy.score(m);
    expect(result.components.stabilityBonus).toBe(20);
  });

  it('netCashRatio >= 0 and < 0.5 → stabilityBonus=12', () => {
    const m = makeMetrics({
      profit: 100 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: 0.3,
    });
    const result = strategy.score(m);
    expect(result.components.stabilityBonus).toBe(12);
  });

  it('netCashRatio=0 → stabilityBonus=12 (boundary: >= 0)', () => {
    const m = makeMetrics({
      profit: 100 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: 0,
    });
    const result = strategy.score(m);
    expect(result.components.stabilityBonus).toBe(12);
  });

  it('negative netCashRatio → stabilityBonus=0', () => {
    const m = makeMetrics({
      profit: 100 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: -0.2,
    });
    const result = strategy.score(m);
    expect(result.components.stabilityBonus).toBe(0);
  });

  it('high earnings yield → earningsYieldScore=60', () => {
    // yield = profit/marketCap >= 0.12
    // profit=120億, marketCap=1000億 → yield=0.12
    const m = makeMetrics({
      profit: 120 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: null,
    });
    const result = strategy.score(m);
    expect(result.components.earningsYieldScore).toBe(60);
  });

  it('PBR > 2 → pbrPenalty=-10', () => {
    const m = makeMetrics({
      profit: 100 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: 0.5,
      pbr: 3,
    });
    const result = strategy.score(m);
    expect(result.components.pbrPenalty).toBe(-10);
  });

  it('score is within 0-100 range', () => {
    const m = makeMetrics({
      profit: 500 * BILLION,
      marketCap: 1_000 * BILLION,
      netCashRatio: 1.0,
      pbr: 1.0,
    });
    const result = strategy.score(m);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ─── CompositeStrategy ──────────────────────────────────────────────────────

describe('CompositeStrategy', () => {
  it('empty constituents array → score=0, not NaN', () => {
    const strategy = new CompositeStrategy([]);
    const m = makeMetrics({});
    const result = strategy.score(m);
    expect(result.score).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('with real constituents → score is average (integer 0-100)', () => {
    const kiyohara = new KiyoharaStrategy();
    const graham = new GrahamStrategy();
    const buffett = new BuffettStrategy();
    const lynch = new LynchStrategy();
    const dividend = new DividendStrategy();

    const strategy = new CompositeStrategy([kiyohara, graham, buffett, lynch, dividend]);

    const m = makeMetrics({
      per: 10,
      pbr: 1.0,
      netCashRatio: 0.3,
      profit: 200 * BILLION,
      equity: 1_000 * BILLION,
      marketCap: 500 * BILLION,
    });

    const result = strategy.score(m);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(result.score)).toBe(true);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('with single constituent → composite score equals that constituent score', () => {
    const kiyohara = new KiyoharaStrategy();
    const composite = new CompositeStrategy([kiyohara]);

    const m = makeMetrics({ netCashRatio: 1.5, marketCap: 50 * BILLION });

    const kScore = kiyohara.score(m).score;
    const cScore = composite.score(m).score;

    expect(cScore).toBe(kScore);
  });

  it('components record contains each constituent id', () => {
    const kiyohara = new KiyoharaStrategy();
    const graham = new GrahamStrategy();
    const strategy = new CompositeStrategy([kiyohara, graham]);

    const m = makeMetrics({ per: 10, pbr: 1.0, netCashRatio: 0.5 });
    const result = strategy.score(m);

    expect(result.components).toHaveProperty('kiyohara');
    expect(result.components).toHaveProperty('graham');
  });

  it('average is computed over all constituents including zero-scores', () => {
    // Use two strategies where we can predict scores:
    // KiyoharaStrategy with NCR=null, small cap: score=5
    // GrahamStrategy with null per: score=0
    // average = (5 + 0) / 2 = 2 (rounded)
    const kiyohara = new KiyoharaStrategy();
    const graham = new GrahamStrategy();
    const strategy = new CompositeStrategy([kiyohara, graham]);

    const m = makeMetrics({
      netCashRatio: null,
      per: null,
      pbr: null,
      marketCap: 30 * BILLION,
    });

    const kScore = kiyohara.score(m).score; // 5 (sizeBonus=5, ncrScore=0)
    const gScore = graham.score(m).score;   // 0 (per=null)

    const result = strategy.score(m);
    expect(result.score).toBe(Math.round((kScore + gScore) / 2));
  });
});
