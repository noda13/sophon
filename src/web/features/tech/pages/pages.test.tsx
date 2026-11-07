import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readLegacyJson } from '../../../../shared/schema/legacy-data.testutil';
import type { Digest, EolItem } from '../../../../shared/schema/tech';
import { articlesSearchSchema, digestSearchSchema } from '../search';
import { article, renderRoute, stubScrollTo } from '../testutil';
import { ArticlesPage } from './ArticlesPage';
import { DigestPage } from './DigestPage';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
stubScrollTo();

const meta = { source: 'tech', generatedAt: '2026-11-07T03:00:00.000Z', run: { status: 'partial', counts: {}, errors: ['EOL failed: Go'] } };

function serveCommon() {
  server.use(
    http.get('*/data/tech/meta.json', () => HttpResponse.json(meta)),
    http.get('*/data/tech/eol.json', () => HttpResponse.json(readLegacyJson('tech', 'eol.json') as EolItem[])),
  );
}

const renderArticles = (url = '/tech') =>
  renderRoute({ url, schema: articlesSearchSchema, component: (route) => <ArticlesPage route={route} /> });
const renderDigest = (url = '/tech') =>
  renderRoute({ url, schema: digestSearchSchema, component: (route) => <DigestPage route={route} /> });

describe('ArticlesPage', () => {
  it('記事、カテゴリタブ、EOL、更新日時を描く', async () => {
    serveCommon();
    server.use(
      http.get('*/data/tech/articles.json', () =>
        HttpResponse.json([
          article('1', { originalTitle: 'AI post', category: 'ai' }),
          article('2', { originalTitle: 'Trend post' }),
        ]),
      ),
    );
    renderArticles('/tech?category=ai');

    expect(await screen.findByRole('link', { name: 'AI post' })).toBeTruthy();
    expect(screen.queryByText('Trend post')).toBeNull();
    expect(screen.getByRole('tab', { name: 'AI / LLM' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('EOL / サポート期限')).toBeTruthy();
    expect(await screen.findByText('一部の収集に失敗しています')).toBeTruthy();
  });

  it('http(s) 以外の記事 URL は # に落とす', async () => {
    serveCommon();
    server.use(
      http.get('*/data/tech/articles.json', () =>
        HttpResponse.json([article('2', { originalTitle: 'bad link', originalUrl: 'javascript:alert(1)' })]),
      ),
    );
    renderArticles();

    const link = await screen.findByRole('link', { name: 'bad link' });
    expect(link.getAttribute('href')).toBe('#');
  });

  it('検索すると URL に反映され、0 件なら空表示になる', async () => {
    serveCommon();
    server.use(http.get('*/data/tech/articles.json', () => HttpResponse.json([article('1', { originalTitle: 'Alpha' })])));
    const t = renderArticles();

    await screen.findByRole('link', { name: 'Alpha' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });

    expect(await screen.findByText('条件に合う記事がありません。絞り込みを変えてください')).toBeTruthy();
    await waitFor(() => expect(t.router.state.location.search).toEqual({ q: 'zzz' }));
  });

  it('記事の取得に失敗するとエラーを出す', async () => {
    serveCommon();
    server.use(http.get('*/data/tech/articles.json', () => new HttpResponse(null, { status: 500 })));
    renderArticles();

    await waitFor(() =>
      expect(screen.getAllByRole('alert').some((el) => /articles\.json/.test(el.textContent ?? ''))).toBe(true),
    );
  });
});

describe('DigestPage', () => {
  const latest: Digest = {
    date: '2026-11-07',
    generatedAt: '2026-11-07T03:00:00.000Z',
    overviewJa: '今日の概要',
    sections: [{ category: 'security', highlights: [{ title: 'CVE の話', summaryJa: '修正済み', url: 'https://e.com/cve' }] }],
  };

  it('最新のダイジェストと日付ナビを描く', async () => {
    serveCommon();
    server.use(
      http.get('*/data/tech/digest/index.json', () => HttpResponse.json({ dates: [latest.date, '2026-11-01'] })),
      http.get('*/data/tech/digest-latest.json', () => HttpResponse.json(latest)),
    );
    renderDigest();

    expect(await screen.findByText(latest.overviewJa)).toBeTruthy();
    expect(screen.getByText(latest.date)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'CVE の話' }).getAttribute('href')).toBe('https://e.com/cve');
    expect(screen.getByRole('heading', { name: 'セキュリティ' })).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', { name: /前の日/ }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole('button', { name: /次の日/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('索引にない日付は「ダイジェストがありません」を出す', async () => {
    serveCommon();
    server.use(http.get('*/data/tech/digest/index.json', () => HttpResponse.json({ dates: ['2026-11-07'] })));
    renderDigest('/tech?date=2026-11-03');

    expect(await screen.findByText('この日のダイジェストがありません')).toBeTruthy();
    expect(screen.getByText('2026-11-03 のダイジェストはまだ生成されていません')).toBeTruthy();
  });
});
