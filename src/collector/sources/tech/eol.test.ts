import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EOL_NO_DATE_DAYS, type EolItem } from '../../../shared/schema/tech';
import { carryForward, collectEol, computeDaysLeft, selectActiveCycles, toEolItems } from './eol';

const today = new Date('2026-11-07T00:00:00.000Z');

describe('computeDaysLeft', () => {
  it('counts days until EOL, negative once it has passed', () => {
    expect(computeDaysLeft('2026-11-17', today)).toBe(10);
    expect(computeDaysLeft('2026-11-02', today)).toBe(-5);
  });

  it('uses the sentinel for products without an EOL date and caps far dates below it', () => {
    expect(computeDaysLeft(false, today)).toBe(EOL_NO_DATE_DAYS);
    expect(computeDaysLeft('9999-01-01', today)).toBe(EOL_NO_DATE_DAYS - 1);
  });
});

describe('selectActiveCycles', () => {
  it('drops ended cycles, puts no-EOL first, then the furthest EOL, and keeps three', () => {
    const cycles = [
      { cycle: '16', eol: '2025-04-30' },
      { cycle: '18', eol: '2027-04-30' },
      { cycle: '20', eol: '2028-04-30' },
      { cycle: '22', eol: '2029-04-30' },
      { cycle: '24', eol: false as const },
      { cycle: '14', eol: true },
    ];
    expect(selectActiveCycles(cycles, today).map((c) => c.cycle)).toEqual(['24', '22', '20']);
  });
});

describe('toEolItems', () => {
  it('omits latest when the API has none', () => {
    const [item] = toEolItems('Go', [{ cycle: '1.25', eol: false }], today);
    expect(item).toEqual({ product: 'Go', cycle: '1.25', eol: false, daysLeft: EOL_NO_DATE_DAYS });
    expect('latest' in item!).toBe(false);
  });
});

describe('carryForward', () => {
  const prev: EolItem[] = [
    { product: 'Go', cycle: '1.24', eol: '2026-12-07', latest: '1.24.1', daysLeft: 99 },
    { product: 'Go', cycle: '1.22', eol: '2026-10-01', daysLeft: 3 },
    { product: 'PHP', cycle: '8.3', eol: false, daysLeft: EOL_NO_DATE_DAYS },
  ];

  it('recomputes daysLeft for the product and drops cycles that have since ended', () => {
    expect(carryForward(prev, 'Go', today)).toEqual([
      { product: 'Go', cycle: '1.24', eol: '2026-12-07', latest: '1.24.1', daysLeft: 30 },
    ]);
  });
});

describe('collectEol', () => {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('falls back to the cache only for the product that failed', async () => {
    server.use(
      http.get('https://endoflife.date/api/nodejs.json', () =>
        HttpResponse.json([{ cycle: 24, eol: '2028-04-30', latest: '24.1.0' }]),
      ),
      http.get('https://endoflife.date/api/go.json', () => new HttpResponse(null, { status: 500 })),
    );
    const prev: EolItem[] = [{ product: 'Go', cycle: '1.25', eol: '2027-02-01', daysLeft: 1 }];
    const result = await collectEol(prev, today, [
      { id: 'nodejs', label: 'Node.js' },
      { id: 'go', label: 'Go' },
    ]);
    expect(result.failedProducts).toEqual(['Go']);
    expect(result.items).toEqual([
      { product: 'Node.js', cycle: '24', eol: '2028-04-30', latest: '24.1.0', daysLeft: 540 },
      { product: 'Go', cycle: '1.25', eol: '2027-02-01', daysLeft: 86 },
    ]);
  });

  it('treats an unexpected response shape as a failure', async () => {
    server.use(http.get('https://endoflife.date/api/go.json', () => HttpResponse.json({ error: 'x' })));
    const result = await collectEol([], today, [{ id: 'go', label: 'Go' }]);
    expect(result).toEqual({ items: [], failedProducts: ['Go'] });
  });
});
