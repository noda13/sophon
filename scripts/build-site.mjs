#!/usr/bin/env node
// 配信物 dist/ を作る: vite build → data ブランチの JSON を dist/data へ → Pages 用の補助ファイル。
import { spawnSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const dataDir = resolve(root, process.env.SOPHON_DATA_DIR ?? 'data');

const build = spawnSync('pnpm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

if (!existsSync(dataDir)) {
  console.error(`data directory not found: ${dataDir}（data ブランチを ${dataDir} に checkout してください）`);
  process.exit(1);
}

const destData = join(dist, 'data');
rmSync(destData, { recursive: true, force: true });
cpSync(dataDir, destData, {
  recursive: true,
  // seen-ids.json は collector の重複判定用で、画面では読まない。
  filter: (src) => !/(^|[\\/])\.git([\\/]|$)/.test(src) && !src.endsWith('seen-ids.json'),
});

// Pages は未知のパスに 404.html を返すため、ディープリンクを SPA の入口へ流す。
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`site ready: ${dist}`);
