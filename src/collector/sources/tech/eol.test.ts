import { HttpResponse, delay, http } from 'msw';
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

  const fast = { minRetryDelayMs: 1, retries: 2 };
  const go = [{ id: 'go', label: 'Go' }];
  const goPrev: EolItem[] = [{ product: 'Go', cycle: '1.25', eol: '2027-02-01', daysLeft: 1 }];
  const goCarried = [{ product: 'Go', cycle: '1.25', eol: '2027-02-01', daysLeft: 86 }];

  it('falls back to the cache only for the product that failed', async () => {
    server.use(
      http.get('https://endoflife.date/api/nodejs.json', () =>
        HttpResponse.json([{ cycle: 24, eol: '2028-04-30', latest: '24.1.0' }]),
      ),
      http.get('https://endoflife.date/api/go.json', () => new HttpResponse(null, { status: 500 })),
    );
    const result = await collectEol(
      goPrev,
      today,
      [
        { id: 'nodejs', label: 'Node.js' },
        { id: 'go', label: 'Go' },
      ],
      { ...fast, retries: 0 },
    );
    expect(result.failedProducts).toEqual(['Go']);
    expect(result.failureReasons).toEqual({ Go: 'HTTP 500' });
    expect(result.items).toEqual([
      { product: 'Node.js', cycle: '24', eol: '2028-04-30', latest: '24.1.0', daysLeft: 540 },
      ...goCarried,
    ]);
  });

  it('treats an unexpected response shape as a failure', async () => {
    server.use(http.get('https://endoflife.date/api/go.json', () => HttpResponse.json({ error: 'x' })));
    const result = await collectEol([], today, go, fast);
    expect(result).toEqual({ items: [], failedProducts: ['Go'], failureReasons: { Go: 'unexpected response shape' } });
  });

  it('retries a 429 and uses the later success', async () => {
    let calls = 0;
    server.use(
      http.get('https://endoflife.date/api/go.json', () =>
        ++calls < 3 ? new HttpResponse(null, { status: 429 }) : HttpResponse.json([{ cycle: '1.26', eol: false }]),
      ),
    );
    const result = await collectEol(goPrev, today, go, fast);
    expect(calls).toBe(3);
    expect(result.failedProducts).toEqual([]);
    expect(result.items).toEqual([{ product: 'Go', cycle: '1.26', eol: false, daysLeft: EOL_NO_DATE_DAYS }]);
  });

  it('carries the cache forward with the status as the reason when 429 persists', async () => {
    let calls = 0;
    server.use(
      http.get('https://endoflife.date/api/go.json', () => {
        calls++;
        return new HttpResponse(null, { status: 429 });
      }),
    );
    const result = await collectEol(goPrev, today, go, fast);
    expect(calls).toBe(3);
    expect(result).toEqual({ items: goCarried, failedProducts: ['Go'], failureReasons: { Go: 'HTTP 429' } });
  });

  it('does not retry a 404', async () => {
    let calls = 0;
    server.use(
      http.get('https://endoflife.date/api/go.json', () => {
        calls++;
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const result = await collectEol([], today, go, fast);
    expect(calls).toBe(1);
    expect(result.failureReasons).toEqual({ Go: 'HTTP 404' });
  });

  it('reports a timeout and carries the cache forward', async () => {
    server.use(http.get('https://endoflife.date/api/go.json', () => delay('infinite')));
    const result = await collectEol(goPrev, today, go, { ...fast, retries: 0, timeoutMs: 20 });
    expect(result).toEqual({ items: goCarried, failedProducts: ['Go'], failureReasons: { Go: 'timeout' } });
  });

  it('stops without retrying when the caller aborts', async () => {
    let calls = 0;
    const controller = new AbortController();
    server.use(
      http.get('https://endoflife.date/api/go.json', async () => {
        calls++;
        controller.abort();
        return delay('infinite');
      }),
    );
    const result = await collectEol(goPrev, today, go, { ...fast, signal: controller.signal });
    expect(calls).toBe(1);
    expect(result.items).toEqual(goCarried);
    expect(result.failureReasons).toEqual({ Go: 'aborted' });
  });
});
