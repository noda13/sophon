import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JQuantsProvider } from '../JQuantsProvider.js';

vi.hoisted(() => {
  process.env.JQUANTS_API_KEY = 'test-key';
  process.env.JQUANTS_REQ_INTERVAL_MS = '0';
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('JQuantsProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('parses listStocks, follows pagination and sends the api key', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          data: [{ Code: '72030', CoName: 'Toyota', S33: '3700', S33Nm: '輸送用機器', MktNm: 'プライム' }],
          pagination_key: 'k1',
        }),
      )
      .mockResolvedValueOnce(json({ data: [{ Code: '13010', CoName: 'Kyokuyo' }] }));

    const stocks = await new JQuantsProvider().listStocks();

    expect(stocks.map(s => [s.code, s.name])).toEqual([['7203', 'Toyota'], ['1301', 'Kyokuyo']]);
    expect(stocks[0].sector33Name).toBe('輸送用機器');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain('pagination_key=k1');
    expect(init.headers['x-api-key']).toBe('test-key');
  });

  it('retries 429 with backoff then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(json({ data: [{ Code: '72030', CoName: 'Toyota' }] }));

    const p = new JQuantsProvider().listStocks();
    await vi.advanceTimersByTimeAsync(40_000);
    const stocks = await p;

    expect(stocks).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting retries on 429', async () => {
    fetchMock.mockImplementation(async () => new Response('slow down', { status: 429 }));

    const assertion = expect(new JQuantsProvider().listStocks()).rejects.toThrow(/HTTP 429/);
    await vi.advanceTimersByTimeAsync(10_000 + 30_000 + 60_000 + 60_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries 5xx with short backoff', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(json({ data: [] }));

    const p = new JQuantsProvider().listStocks();
    await vi.advanceTimersByTimeAsync(2_000);
    await p;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry other 4xx', async () => {
    fetchMock.mockResolvedValue(new Response('bad key', { status: 403 }));
    await expect(new JQuantsProvider().listStocks()).rejects.toThrow(/HTTP 403/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
