import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, type JsonBodyType, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeIdea, makeIssue } from '../logic/fixtures.testutil';
import { IdeasSearchSchema, IssuesSearchSchema } from '../logic/search';
import { IdeaDetailPage } from './IdeaDetailPage';
import { IdeasPage } from './IdeasPage';
import { IssueDashboardPage } from './IssueDashboardPage';
import { IssueDetailPage } from './IssueDetailPage';

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  // jsdom 未実装の window.scrollTo を、ルーターの遷移時のスクロール復元が呼ぶ
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

const issues = [
  makeIssue({ id: 'e1', originalTitle: '教育の課題', category: 'education', severityScore: 40 }),
  makeIssue({
    id: 'g1',
    originalTitle: '行政の課題',
    category: 'governance',
    sourceType: 'gov',
    severityScore: 85,
    originalUrl: 'javascript:alert(1)',
    affectedDomain: ['自治体'],
    ideaGeneratedAt: '2026-11-02T00:00:00Z',
    proposedAppIdea: '申請を代行するアプリ',
    mvpFeatures: ['入力補助'],
    targetUsers: '住民',
    difficulty: 'low',
  }),
];
const ideas = [makeIdea({ id: 'g1', originalTitle: '行政の課題', proposedAppIdea: '申請を代行するアプリ', category: 'governance' })];
const summary = [
  { category: 'education', count: 3, avgSeverity: 40, avgAppifiability: 55 },
  { category: 'governance', count: 1, avgSeverity: 85, avgAppifiability: 70 },
];

function serve(files: { issues?: JsonBodyType; ideas?: JsonBodyType; summary?: JsonBodyType; meta?: JsonBodyType } = {}) {
  server.use(
    http.get('*/data/issue/issues.json', () => HttpResponse.json(files.issues ?? issues)),
    http.get('*/data/issue/ideas.json', () => HttpResponse.json(files.ideas ?? ideas)),
    http.get('*/data/issue/category-summary.json', () => HttpResponse.json(files.summary ?? summary)),
    http.get('*/data/issue/meta.json', () =>
      HttpResponse.json(files.meta ?? { lastUpdated: new Date().toISOString() }),
    ),
  );
}

function renderAt(url: string) {
  const rootRoute = createRootRoute();
  const dashboard = createRoute({
    getParentRoute: () => rootRoute,
    path: '/issue',
    validateSearch: IssuesSearchSchema,
    component: () => <IssueDashboardPage route={dashboard} />,
  });
  const issueDetail = createRoute({
    getParentRoute: () => rootRoute,
    path: '/issue/issues/$id',
    component: function Detail() {
      return <IssueDetailPage id={issueDetail.useParams().id} />;
    },
  });
  const ideasList = createRoute({
    getParentRoute: () => rootRoute,
    path: '/issue/ideas',
    validateSearch: IdeasSearchSchema,
    component: () => <IdeasPage route={ideasList} />,
  });
  const ideaDetail = createRoute({
    getParentRoute: () => rootRoute,
    path: '/issue/ideas/$id',
    component: function Detail() {
      return <IdeaDetailPage id={ideaDetail.useParams().id} />;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboard, issueDetail, ideasList, ideaDetail]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('ダッシュボード', () => {
  it('ヒートマップ、フィード、アイデア、鮮度を並べる', async () => {
    serve();
    renderAt('/issue');
    expect(await screen.findByRole('heading', { name: '社会課題ダッシュボード' })).toBeTruthy();
    expect(await screen.findByText('教育の課題')).toBeTruthy();
    expect(screen.getByText('行政の課題', { selector: 'h3 a' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /教育・学習/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'アプリ化アイデア Top' })).toBeTruthy();
    expect(screen.getByText('2 件')).toBeTruthy();
    expect(await screen.findByText(/更新$/)).toBeTruthy();
  });

  it('URL のカテゴリで絞り込む', async () => {
    serve();
    renderAt('/issue?category=education');
    await screen.findByText('教育の課題');
    expect(screen.queryByText('行政の課題', { selector: 'h3 a' })).toBeNull();
    expect(screen.getByText('1 件')).toBeTruthy();
    expect(screen.getByRole('button', { name: /教育・学習/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('ヒートマップのセルで URL のカテゴリが切り替わる', async () => {
    serve();
    const router = renderAt('/issue');
    fireEvent.click(await screen.findByRole('button', { name: /行政・制度/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ category: 'governance' }));
    await waitFor(() => expect(screen.getByText('1 件')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /行政・制度/ }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('category'));
  });

  it('課題の取得に失敗するとエラーを出す', async () => {
    server.use(
      http.get('*/data/issue/issues.json', () => new HttpResponse(null, { status: 500 })),
      http.get('*/data/issue/ideas.json', () => HttpResponse.json([])),
      http.get('*/data/issue/category-summary.json', () => HttpResponse.json([])),
      http.get('*/data/issue/meta.json', () => HttpResponse.json({ lastUpdated: '2026-11-01T00:00:00Z' })),
    );
    renderAt('/issue');
    expect(await screen.findByText('課題データの取得に失敗しました')).toBeTruthy();
    expect(await screen.findByText('アイデアがありません')).toBeTruthy();
  });

  it('収集が失敗した meta は警告として出す', async () => {
    serve({
      meta: {
        source: 'issue',
        generatedAt: new Date().toISOString(),
        run: { status: 'failed', counts: {}, errors: ['x'] },
      },
    });
    renderAt('/issue');
    expect(await screen.findByText(/最新の収集に失敗しています/)).toBeTruthy();
  });
});

describe('課題の詳細', () => {
  it('概要、影響領域、アイデアを出し、危険な URL は外部リンクにしない', async () => {
    serve();
    renderAt('/issue/issues/g1');
    expect(await screen.findByRole('heading', { level: 1, name: '行政の課題' })).toBeTruthy();
    expect(screen.getByText('自治体')).toBeTruthy();
    expect(screen.getByText('申請を代行するアプリ')).toBeTruthy();
    expect(screen.getByText('入力補助')).toBeTruthy();
    expect(screen.queryByText(/元記事を見る/)).toBeNull();
  });

  it('http の URL は別タブで開くリンクにする', async () => {
    serve();
    renderAt('/issue/issues/e1');
    const link = await screen.findByText(/元記事を見る/);
    expect(link.getAttribute('href')).toBe('https://example.com/a');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.queryByText('アプリ化アイデア')).toBeNull();
  });

  it('無い id は見つからないと出す', async () => {
    serve();
    renderAt('/issue/issues/none');
    expect(await screen.findByText('該当する課題が見つかりません')).toBeTruthy();
  });
});

describe('アイデア', () => {
  it('一覧に件数とカードを出す', async () => {
    serve();
    renderAt('/issue/ideas');
    expect(await screen.findByText('申請を代行するアプリ')).toBeTruthy();
    expect(screen.getByText('1 件のアイデア')).toBeTruthy();
    expect(screen.getByRole('link', { name: '詳細を見る' }).getAttribute('href')).toBe('/issue/ideas/g1');
  });

  it('難易度の絞り込みで 0 件なら空の表示', async () => {
    serve();
    renderAt('/issue/ideas?difficulty=high');
    expect(await screen.findByText('該当するアイデアがありません')).toBeTruthy();
  });

  it('詳細はアイデアを主見出しにし、元の課題を続ける', async () => {
    serve();
    renderAt('/issue/ideas/g1');
    expect(await screen.findByRole('heading', { level: 1, name: 'アプリ化アイデア' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '元の社会課題' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: '行政の課題' })).toBeTruthy();
  });

  it('無い id は見つからないと出す', async () => {
    serve();
    renderAt('/issue/ideas/none');
    expect(await screen.findByText('該当するアイデアが見つかりません')).toBeTruthy();
  });
});
