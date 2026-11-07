import { describe, expect, it } from 'vitest';
import { listLegacyFiles, readLegacyJson } from './legacy-data.testutil';
import { RankingFileSchema, StockDetailSchema, StocksFileSchema, StrategiesFileSchema, STRATEGY_IDS } from './stock';

describe('stock schema against legacy data', () => {
  const files = listLegacyFiles('stock');

  it('parses strategies.json', () => {
    const r = StrategiesFileSchema.safeParse(readLegacyJson('stock', 'strategies.json'));
    expect(r.success).toBe(true);
  });

  it('parses stocks.json', () => {
    const r = StocksFileSchema.safeParse(readLegacyJson('stock', 'stocks.json'));
    expect(r.success).toBe(true);
  });

  it.each(STRATEGY_IDS)('parses ranking-%s.json', (id) => {
    const r = RankingFileSchema.safeParse(readLegacyJson('stock', `ranking-${id}.json`));
    expect(r.success).toBe(true);
  });

  it('has a ranking file for every strategy', () => {
    for (const id of STRATEGY_IDS) expect(files).toContain(`ranking-${id}.json`);
  });

  it('parses one stock-<code>.json', () => {
    const file = files.find((f) => f.startsWith('stock-'));
    expect(file).toBeDefined();
    const r = StockDetailSchema.safeParse(readLegacyJson('stock', file!));
    expect(r.success).toBe(true);
  });
});
