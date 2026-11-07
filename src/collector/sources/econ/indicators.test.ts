import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EconomicIndicator } from '../../../shared/schema/econ';
import { ASSETS, collectIndicators as collect, unavailableIndicators } from './indicators';

const NOW = '2026-10-24T03:00:00.000Z';
const OLD = '2026-10-20T03:00:00.000Z';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const collectIndicators = (prev: EconomicIndicator[]) => collect(prev, new Date(NOW));

type Behavior =
  | { price?: unknown; closes?: Array<number | null> | null; noIndicators?: boolean }
  | 'http-error'
  | 'http-error-with-valid-body'
  | 'network-error'
  | 'bad-json';

function payload(b: Exclude<Behavior, string>) {
  return {
    chart: {
      result: [
        {
          meta: 'price' in b ? { regularMarketPrice: b.price } : {},
          ...(b.noIndicators ? {} : { indicators: { quote: [{ close: b.closes ?? undefined }] } }),
        },
      ],
    },
  };
}

// Returns the requested URLs so a test can assert on how each symbol was queried.
function mockYahoo(bySymbol: Record<string, Behavior>): string[] {
  const requested: string[] = [];
  server.use(
    http.get('https://query1.finance.yahoo.com/v8/finance/chart/:symbol', ({ request }) => {
      requested.push(request.url);
      const symbol = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '');
      const behavior = bySymbol[symbol] ?? 'http-error';
      if (behavior === 'network-error') return HttpResponse.error();
      if (behavior === 'http-error') return new HttpResponse('', { status: 500 });
      if (behavior === 'http-error-with-valid-body') {
        return HttpResponse.json(payload({ price: 105, closes: [100, 101] }), { status: 429 });
      }
      if (behavior === 'bad-json') return new HttpResponse('<html>', { status: 200 });
      return HttpResponse.json(payload(behavior));
    }),
  );
  return requested;
}

function allOk(overrides: Record<string, Behavior> = {}): Record<string, Behavior> {
  const base = Object.fromEntries(ASSETS.map((a) => [a.symbol, { price: 100, closes: [90, 95, 100] } as Behavior]));
  return { ...base, ...overrides };
}

function cached(code: string, overrides: Partial<EconomicIndicator> = {}): EconomicIndicator {
  return {
    code,
    name: `cached ${code}`,
    value: 50,
    previousValue: 45,
    unit: 'cached-unit',
    source: 'yahoo',
    recordedAt: OLD,
    ...overrides,
  };
}

const find = (list: EconomicIndicator[], code: string) => list.find((i) => i.code === code);

describe('collectIndicators', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns one entry per asset in ASSETS order when every fetch succeeds', async () => {
    mockYahoo(allOk());
    const result = await collectIndicators([]);
    expect(result.map((i) => i.code)).toEqual(ASSETS.map((a) => a.code));
  });

  it('fills name, unit, source and recordedAt from the asset table and the current time', async () => {
    mockYahoo(allOk({ '^VIX': { price: 18.5, closes: [17, 18] } }));
    const vix = find(await collectIndicators([cached('VIX', { name: 'stale name', unit: 'x' })]), 'VIX');
    expect(vix).toEqual({
      code: 'VIX',
      name: '恐怖指数(VIX)',
      value: 18.5,
      previousValue: 17,
      unit: 'pt',
      source: 'yahoo',
      recordedAt: NOW,
    });
  });

  it('requests each symbol URL-encoded from the 5 day daily chart endpoint', async () => {
    const urls = mockYahoo(allOk());
    await collectIndicators([]);
    expect(urls).toContain('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d');
    expect(urls).toContain('https://query1.finance.yahoo.com/v8/finance/chart/USDJPY%3DX?interval=1d&range=5d');
    expect(urls).toHaveLength(ASSETS.length);
  });

  describe('previousValue', () => {
    it('is the second-to-last close', async () => {
      mockYahoo(allOk({ '^GSPC': { price: 105, closes: [100, 101, 103] } }));
      const spx = find(await collectIndicators([]), 'SPX');
      expect(spx?.previousValue).toBe(101);
    });

    it('skips null closes before picking the second-to-last one', async () => {
      mockYahoo(allOk({ '^GSPC': { price: 105, closes: [100, 101, null, 103, null] } }));
      const spx = find(await collectIndicators([]), 'SPX');
      expect(spx?.previousValue).toBe(101);
    });

    it('is the first close when exactly two closes are available', async () => {
      mockYahoo(allOk({ '^GSPC': { price: 105, closes: [null, 100, 104] } }));
      const spx = find(await collectIndicators([]), 'SPX');
      expect(spx?.previousValue).toBe(100);
    });

    it.each([
      ['a single close', { price: 105, closes: [104] }],
      ['only null closes', { price: 105, closes: [null, null, 104, null] }],
      ['no closes', { price: 105, closes: [] }],
      ['a missing close array', { price: 105, closes: null }],
      ['a missing indicators block', { price: 105, noIndicators: true }],
    ] as Array<[string, Behavior]>)('falls back to the cached value with %s', async (_label, behavior) => {
      mockYahoo(allOk({ '^GSPC': behavior }));
      const spx = find(await collectIndicators([cached('SPX', { value: 88 })]), 'SPX');
      expect(spx?.value).toBe(105);
      expect(spx?.previousValue).toBe(88);
    });

    it('is null when there are fewer than two closes and no cached value', async () => {
      mockYahoo(allOk({ '^GSPC': { price: 105, closes: [104] } }));
      const spx = find(await collectIndicators([]), 'SPX');
      expect(spx?.previousValue).toBeNull();
    });
  });

  describe('when a fetch fails', () => {
    const failures: Array<[string, Behavior]> = [
      ['an HTTP error', 'http-error'],
      ['an HTTP error with a parseable body', 'http-error-with-valid-body'],
      ['a network error', 'network-error'],
      ['a non-JSON body', 'bad-json'],
      ['a missing price', {}],
      ['a non-numeric price', { price: '105', closes: [100, 101] }],
      ['a null price', { price: null, closes: [100, 101] }],
    ];

    it.each(failures)('carries the cached entry forward as stale after %s', async (_label, behavior) => {
      mockYahoo(allOk({ '^DJI': behavior }));
      const entry = cached('DJIA', { value: 42000, previousValue: 41500 });
      const djia = find(await collectIndicators([entry]), 'DJIA');
      expect(djia).toEqual({ ...entry, stale: true });
    });

    it('keeps the original recordedAt instead of the current time', async () => {
      mockYahoo(allOk({ '^DJI': 'network-error' }));
      const djia = find(await collectIndicators([cached('DJIA')]), 'DJIA');
      expect(djia?.recordedAt).toBe(OLD);
      expect(djia?.recordedAt).not.toBe(NOW);
    });

    it('keeps the cached name, unit and value rather than the asset table values', async () => {
      mockYahoo(allOk({ '^DJI': 'http-error' }));
      const djia = find(await collectIndicators([cached('DJIA')]), 'DJIA');
      expect(djia).toMatchObject({ name: 'cached DJIA', unit: 'cached-unit', value: 50, previousValue: 45 });
    });

    it.each(failures)('omits the indicator after %s when nothing is cached', async (_label, behavior) => {
      mockYahoo(allOk({ '^DJI': behavior }));
      const result = await collectIndicators([]);
      expect(find(result, 'DJIA')).toBeUndefined();
      expect(result).toHaveLength(ASSETS.length - 1);
    });

    it('still returns the other indicators fresh and without a stale flag', async () => {
      mockYahoo(allOk({ '^DJI': 'network-error' }));
      const result = await collectIndicators([cached('DJIA')]);
      expect(result).toHaveLength(ASSETS.length);
      for (const i of result.filter(i => i.code !== 'DJIA')) {
        expect(i).not.toHaveProperty('stale');
        expect(i.recordedAt).toBe(NOW);
      }
    });

    it('keeps an already stale cached entry stale', async () => {
      mockYahoo(allOk({ '^DJI': 'http-error' }));
      const djia = find(await collectIndicators([cached('DJIA', { stale: true })]), 'DJIA');
      expect(djia?.stale).toBe(true);
    });

    it('does not mutate the cached entry that is carried forward', async () => {
      mockYahoo(allOk({ '^DJI': 'http-error' }));
      const entry = cached('DJIA');
      await collectIndicators([entry]);
      expect(entry).not.toHaveProperty('stale');
    });
  });

  describe('fresh entries', () => {
    it('have no stale key at all', async () => {
      mockYahoo(allOk());
      const result = await collectIndicators([]);
      for (const i of result) expect(Object.keys(i)).not.toContain('stale');
    });

    it('drop the stale flag of a previously stale cached entry', async () => {
      mockYahoo(allOk());
      const djia = find(await collectIndicators([cached('DJIA', { stale: true })]), 'DJIA');
      expect(djia).not.toHaveProperty('stale');
      expect(djia?.recordedAt).toBe(NOW);
    });
  });

  it('ignores cached entries whose code is not in ASSETS', async () => {
    mockYahoo(allOk({ '^DJI': 'http-error' }));
    const result = await collectIndicators([cached('DJIA'), cached('MYSTERY')]);
    expect(find(result, 'MYSTERY')).toBeUndefined();
    expect(result).toHaveLength(ASSETS.length);
  });

  it('returns an empty array when every fetch fails and nothing is cached', async () => {
    mockYahoo({});
    expect(await collectIndicators([])).toEqual([]);
  });

  it('returns every cached asset as stale when every fetch fails', async () => {
    mockYahoo({});
    const prev = ASSETS.map(a => cached(a.code));
    const result = await collectIndicators(prev);
    expect(result).toHaveLength(ASSETS.length);
    expect(result.every(i => i.stale === true && i.recordedAt === OLD)).toBe(true);
  });
});

describe('unavailableIndicators', () => {
  const fresh = (code: string): EconomicIndicator => cached(code, { recordedAt: NOW });

  it('is empty when every asset has a fresh value', () => {
    expect(unavailableIndicators(ASSETS.map((a) => fresh(a.code)))).toEqual([]);
  });

  it('lists assets that are stale or missing altogether', () => {
    const indicators = ASSETS.filter((a) => a.code !== 'WTI').map((a) =>
      a.code === 'VIX' ? { ...fresh(a.code), stale: true } : fresh(a.code),
    );
    expect(unavailableIndicators(indicators)).toEqual(['VIX', 'WTI']);
  });
});
