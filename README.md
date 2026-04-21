# waga-scope — 清原流バリュー・スクリーナー

清原達郎『わが投資術』（2024）の投資哲学に基づき、**ネットキャッシュ比率**と**キャッシュニュートラルPER**でスクリーニングする日本小型株バリュースクリーナー。

詳細プラン: `/Users/naoki-odajima/.claude/plans/econoguard-per-composed-stonebraker.md`

## Stack

- Backend: Express 4 + Prisma 5 + Zod + node-cron + TypeScript
- Frontend: React 19 + Vite + Tailwind + TanStack Query
- DB: SQLite (Prisma)
- Ports: backend 8902, frontend 3902

## Quick Start

```bash
pnpm install
cd backend && DATABASE_URL="file:./dev.db" pnpm prisma migrate dev --name init --skip-seed
PORT=8902 DATA_PROVIDER=csv DATABASE_URL=file:./dev.db pnpm -C backend dev
# 別ターミナル
pnpm -C frontend dev
# 同期トリガ
curl -X POST http://localhost:8902/api/admin/sync
```

## Phase Status

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 0 | CSV seed + ランキング1画面 | **現在** |
| Phase 1 | J-Quants Free tier + 30銘柄 | 未着手 |
| Phase 2 | EDINET XBRL + 証券会社CSV | 未着手 |
