import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { buildDataUrlPattern, buildNavigateFallbackDenylist } from './pwa-config';

const base = process.env.VITE_BASE_PATH || '/';
const dataUrlPattern = buildDataUrlPattern(base);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Econoguard',
        short_name: 'Econoguard',
        description:
          'グローバルな経済リスクを自動収集・AI分析・可視化するダッシュボード',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#111827',
        background_color: '#111827',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        // バックエンド API は常にネットワークへ流し、SPA フォールバックの対象にもしない
        navigateFallbackDenylist: buildNavigateFallbackDenylist(base),
        runtimeCaching: [
          {
            // データ JSON は precache せず、オンライン時は常に最新を取得する
            // 正規表現はクロスオリジン URL では先頭一致のみ許可されるため、同一オリジンのデータ JSON だけに当たる
            urlPattern: dataUrlPattern,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'econoguard-data',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  base,
  server: {
    port: 3901,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8901',
        changeOrigin: true,
      },
    },
  },
});
