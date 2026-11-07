import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Digest } from '../../../../shared/schema/tech';
import { readLegacyJson } from '../../../../shared/schema/legacy-data.testutil';
import { newQueryClient } from '../testutil';
import { digestFile, useDigest } from './useDigest';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

const digest = (date: string): Digest => ({ date, generatedAt: `${date}T03:00:00.000Z`, overviewJa: `概要 ${date}`, sections: [] });
const latestDigest = readLegacyJson('tech', 'digest-latest.json') as Digest;

function wrapper() {
  const client = newQueryClient();
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const requested: string[] = [];
function serve(dates: string[] | 'missing') {
  requested.length = 0;
  server.use(
    http.get('*/data/tech/digest/index.json', () =>
      dates === 'missing' ? new HttpResponse(null, { status: 404 }) : HttpResponse.json({ dates }),
    ),
    http.get('*/data/tech/digest-latest.json', () => {
      requested.push('digest-latest.json');
      return HttpResponse.json(dates === 'missing' ? latestDigest : digest(dates[0]!));
    }),
    http.get('*/data/tech/digest/:file', ({ params }) => {
      requested.push(`digest/${params.file}`);
      return HttpResponse.json(digest(String(params.file).replace('.json', '')));
    }),
  );
}

describe('digestFile', () => {
  it('省略と最新日は digest-latest.json、それ以外は日付のファイル', () => {
    expect(digestFile(undefined, '2026-11-07')).toBe('digest-latest.json');
    expect(digestFile('2026-11-07', '2026-11-07')).toBe('digest-latest.json');
    expect(digestFile('2026-11-05', '2026-11-07')).toBe('digest/2026-11-05.json');
  });
});

describe('useDigest', () => {
  it('日付なしは最新を返し、前の日だけが選べる', async () => {
    serve(['2026-11-07', '2026-11-05']);
    const { result } = renderHook(() => useDigest(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.digest?.overviewJa).toBe('概要 2026-11-07'));
    expect(result.current).toMatchObject({ date: '2026-11-07', prevDate: '2026-11-05', nextDate: null, isMissing: false });
  });

  it('日付指定は索引で前後を解決し、その日のファイルを読む', async () => {
    serve(['2026-11-07', '2026-11-05', '2026-11-02']);
    const { result } = renderHook(() => useDigest('2026-11-05'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.digest?.date).toBe('2026-11-05'));
    expect(result.current).toMatchObject({ prevDate: '2026-11-02', nextDate: '2026-11-07' });
    expect(requested).toEqual(['digest/2026-11-05.json']);
  });

  it('指定日が最新日なら digest-latest.json を読む', async () => {
    serve(['2026-11-07', '2026-11-05']);
    const { result } = renderHook(() => useDigest('2026-11-07'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.digest?.date).toBe('2026-11-07'));
    expect(requested).toEqual(['digest-latest.json']);
  });

  it('索引にない日は取りに行かず isMissing になる', async () => {
    serve(['2026-11-07', '2026-11-05']);
    const { result } = renderHook(() => useDigest('2026-11-06'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isMissing).toBe(true));
    expect(result.current).toMatchObject({ digest: undefined, error: null, isPending: false, prevDate: '2026-11-05', nextDate: '2026-11-07' });
    expect(requested).toEqual([]);
  });

  it('索引がなくても最新は表示でき、前後は選べない', async () => {
    serve('missing');
    const { result } = renderHook(() => useDigest(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.digest?.date).toBe(latestDigest.date));
    expect(result.current).toMatchObject({ prevDate: null, nextDate: null });
  });

  it('索引がないときの日付指定は、その日のファイルを直接読みに行く', async () => {
    serve('missing');
    const { result } = renderHook(() => useDigest('2026-10-01'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.digest?.date).toBe('2026-10-01'));
    expect(requested).toEqual(['digest/2026-10-01.json']);
  });

  it('ダイジェストの取得に失敗すると error を返す', async () => {
    serve(['2026-11-07']);
    server.use(http.get('*/data/tech/digest-latest.json', () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useDigest(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  });
});
