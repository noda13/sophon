import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { type Plugin, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// 本番は build-site が dist/data に data ブランチを置く。開発時はリポジトリルートの data/ を同じ URL で返す
function serveLocalData(): Plugin {
  return {
    name: 'sophon:serve-local-data',
    apply: 'serve',
    configureServer(server) {
      const dataRoot = join(server.config.root, 'data');
      const prefix = `${server.config.base}data/`;
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? '';
        if (!pathname.startsWith(prefix)) return next();

        const file = resolveDataFile(dataRoot, pathname.slice(prefix.length));
        const found = file !== null && isFile(file);
        if (!found) {
          // SPA のフォールバックで index.html が返ると JSON のパースエラーに化けるため、ここで 404 にする
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        createReadStream(file as string).pipe(res);
      });
    },
  };
}

function resolveDataFile(dataRoot: string, relative: string): string | null {
  try {
    const file = normalize(join(dataRoot, decodeURIComponent(relative)));
    return file.startsWith(dataRoot + sep) ? file : null;
  } catch {
    return null;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const base = process.env.SITE_BASE ?? '/sophon/';

// workbox は関数を toString で sw.js へ埋め込むため、クロージャ変数を参照できない。prefix をリテラルとして焼き込む
type RouteMatchCallback = (options: { url: URL }) => boolean;

function swDataMatcher(prefix: string): RouteMatchCallback {
  return new Function(
    '{ url }',
    `return url.origin === self.location.origin && url.pathname.startsWith(${JSON.stringify(prefix)});`,
  ) as RouteMatchCallback;
}

export default defineConfig({
  base,
  plugins: [
    // react より前に置く必要がある（routeTree.gen.ts を先に生成するため）
    tanstackRouter({
      target: 'react',
      routesDirectory: 'src/web/routes',
      generatedRouteTree: 'src/web/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    serveLocalData(),
    VitePWA({
      registerType: 'autoUpdate',
      base,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'sophon',
        short_name: 'sophon',
        description: '株・技術・課題・経済の情報をまとめて見るサイト',
        lang: 'ja',
        scope: base,
        start_url: base,
        display: 'standalone',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // data は毎日更新されるため、オンラインなら常に最新を取り、オフラインのときだけ前回分を返す
        runtimeCaching: [
          {
            urlPattern: swDataMatcher(`${base}data/`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sophon-data',
              networkTimeoutSeconds: 5,
              // 銘柄詳細だけで数千ファイルあるため、閲覧のたびに溜まらないよう上限と期限を設ける
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
        ],
        // data の JSON を SPA の index.html にフォールバックさせない
        navigateFallbackDenylist: [/\/data\//],
      },
    }),
  ],
});
