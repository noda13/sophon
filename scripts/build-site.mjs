#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site-dist');
const sitePath = process.env.SITE_PATH ?? '/sophon/';

const apps = [
  { id: 'stock', title: 'Stock', desc: '株式のランキングと銘柄分析' },
  { id: 'tech', title: 'Tech', desc: 'IT・技術ニュースのダイジェストと EOL 情報' },
  { id: 'issue', title: 'Issue', desc: '社会課題の収集とアイデア整理' },
  { id: 'econ', title: 'Econ', desc: '経済リスク指標のダッシュボード' },
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const app of apps) {
  console.log(`\n=== build ${app.id} ===`);
  const result = spawnSync(
    'pnpm',
    ['--filter', `./apps/${app.id}/frontend`, 'run', 'build'],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        SITE_BASE: `${sitePath}${app.id}/`,
        VITE_STATIC_DATA: 'true',
      },
    },
  );
  if (result.status !== 0) {
    console.error(`build failed: ${app.id}`);
    process.exit(result.status ?? 1);
  }

  const dist = join(root, 'apps', app.id, 'frontend', 'dist');
  const dest = join(outDir, app.id);
  cpSync(dist, dest, { recursive: true });

  // Pages は未知のパスに 404.html を返すため、BrowserRouter のディープリンクを index.html に流す
  if (existsSync(join(dest, 'index.html'))) {
    copyFileSync(join(dest, 'index.html'), join(dest, '404.html'));
  }
}

const cards = apps
  .map(
    (a) => `      <a class="card" href="${a.id}/">
        <strong>${a.title}</strong>
        <span>${a.desc}</span>
      </a>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>sophon</title>
    <style>
      :root { color-scheme: light dark; --bg: #f8fafc; --fg: #0f172a; --card: #fff; --border: #e2e8f0; --muted: #64748b; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #0f172a; --fg: #f1f5f9; --card: #1e293b; --border: #334155; --muted: #94a3b8; }
      }
      body { margin: 0; padding: 2rem 1rem; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; }
      main { max-width: 36rem; margin: 0 auto; }
      h1 { margin: 0 0 1.5rem; }
      .card { display: block; margin-bottom: 0.75rem; padding: 1rem; background: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; color: inherit; text-decoration: none; }
      .card:hover { border-color: var(--muted); }
      .card span { display: block; margin-top: 0.25rem; color: var(--muted); font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>sophon</h1>
${cards}
    </main>
  </body>
</html>
`;
writeFileSync(join(outDir, 'index.html'), html);
writeFileSync(join(outDir, '.nojekyll'), '');
console.log(`\nsite-dist ready: ${outDir}`);
