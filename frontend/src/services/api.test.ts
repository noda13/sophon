import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const axiosGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: { create: () => ({ get: axiosGet }) },
}));

const strategies = [
  { id: 'kiyohara', displayName: '清原流', description: 'd', active: true },
];

async function loadApi(flag: string | undefined, dev: boolean) {
  vi.resetModules();
  vi.stubEnv('VITE_STATIC_DATA', flag ?? '');
  vi.stubEnv('DEV', dev);
  return import('./api');
}

describe('resolveStaticMode', () => {
  it('flag overrides environment', async () => {
    const { resolveStaticMode } = await loadApi(undefined, true);
    expect(resolveStaticMode('true', true)).toBe(true);
    expect(resolveStaticMode('false', false)).toBe(false);
  });

  it('falls back to production build = static', async () => {
    const { resolveStaticMode } = await loadApi(undefined, true);
    expect(resolveStaticMode(undefined, false)).toBe(true);
    expect(resolveStaticMode(undefined, true)).toBe(false);
    expect(resolveStaticMode('', false)).toBe(true);
  });
});

describe('fetchStrategies mode selection', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => strategies });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads static JSON when VITE_STATIC_DATA=true', async () => {
    const { fetchStrategies } = await loadApi('true', true);
    await expect(fetchStrategies()).resolves.toEqual(strategies);
    expect(fetchMock).toHaveBeenCalledWith('/data/strategies.json');
  });

  it('reads static JSON in a production build without the flag', async () => {
    const { fetchStrategies } = await loadApi(undefined, false);
    await fetchStrategies();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the server API when VITE_STATIC_DATA=false even in production', async () => {
    const { fetchStrategies } = await loadApi('false', false);
    axiosGet.mockResolvedValue({ data: strategies });
    await expect(fetchStrategies()).resolves.toEqual(strategies);
    expect(axiosGet).toHaveBeenCalledWith('/strategies');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects static payloads that fail schema validation', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 'unknown' }] });
    const { fetchStrategies } = await loadApi('true', true);
    await expect(fetchStrategies()).rejects.toThrow();
  });

  it('throws on non-ok static responses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    const { fetchStrategies } = await loadApi('true', true);
    await expect(fetchStrategies()).rejects.toThrow(/404/);
  });
});
