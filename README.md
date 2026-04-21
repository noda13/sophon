# waga-scope — 清原流バリュー・スクリーナー

清原達郎『わが投資術』（2024）の投資哲学に基づき、**ネットキャッシュ比率**と**キャッシュニュートラルPER**でスクリーニングする日本小型株バリュースクリーナー。

## Stack

- Backend: Express 4 + Prisma 5 + Zod + TypeScript
- Frontend: React 19 + Vite + Tailwind + TanStack Query + Recharts + react-router
- DB: SQLite (Prisma)
- Ports: backend 8902, frontend 3902

## Phase Status

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 0 | CSV seed + ランキング1画面 | 完了 |
| Phase 1a | Strategy パターン + 50銘柄 + StockDetail + 静的JSON配信 | **完了** |
| Phase 1b | J-Quants スケルトン（`JQuantsProvider` 実装） | 未着手（スケルトンあり） |
| Phase 2 | EDINET XBRL + Graham/Buffett 戦略 + 証券会社CSV | 未着手 |
| Phase 3 | マルチ戦略ダッシュボード + バックテスト | 未着手 |

## Quick Start（ローカル動的モード）

```bash
pnpm install
# DBマイグレーション（初回のみ）
cd backend && DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy && cd ..

# バックエンド起動
PORT=8902 DATA_PROVIDER=csv DATABASE_URL=file:./prisma/dev.db pnpm -C backend dev

# 別ターミナル: フロントエンド起動
pnpm -C frontend dev

# 同期トリガ（50銘柄をDBに取込）
curl -X POST http://localhost:8902/api/admin/sync
```

## 静的JSON生成（GitHub Pages 用）

```bash
# CsvProvider で動作（J-Quants 未登録でもOK）
DATA_PROVIDER=csv pnpm exec tsx scripts/collect-static.ts
# → frontend/public/data/*.json に出力（54ファイル）
```

## DATA_PROVIDER の切替

| 値 | 説明 |
|---|---|
| `csv` | `backend/seed/stocks.csv` から読込。J-Quants 不要。デフォルト |
| `jquants` | J-Quants API 利用（`.env` に認証情報が必要） |

```bash
# .env または環境変数で指定
DATA_PROVIDER=csv         # サンプルデータ（デフォルト）
DATA_PROVIDER=jquants     # 実データ（Phase 1b 実装後）
```

J-Quants を使うには https://jpx-jquants.com/ でFree tier 登録後、`.env` に設定：

```
JQUANTS_MAIL_ADDRESS=your@email.com
JQUANTS_PASSWORD=yourpassword
```

## Strategy パターン

### Phase 1 実装：清原流（`KiyoharaStrategy`）

| 指標 | 役割 |
|---|---|
| NCR（ネットキャッシュ比率） | 1.0超で超割安水準。スコアの主成分（0-80点） |
| CNPER（キャッシュニュートラルPER） | 0〜10倍で加点、20倍超で減点（-15〜+20点） |
| 時価総額 | 500億超でペナルティ（-10点）、50億以下でボーナス（+5点） |
| 赤字（profit ≤ 0） | スコア上限50点 |

### 新しい Strategy の追加方法（Phase 2 以降）

1. `backend/src/strategies/GrahamStrategy.ts` を作成し `InvestmentStrategy` を実装
2. `backend/src/strategies/index.ts` の `strategies` 配列に追加
3. `meta.active = true` にすれば API・静的JSON・フロントエンド全てに自動反映

```ts
// backend/src/strategies/GrahamStrategy.ts の例
export class GrahamStrategy implements InvestmentStrategy {
  meta = { id: 'graham', displayName: 'グレアム', description: '...', active: true };
  score(m: StockMetrics): StrategyScore { /* ... */ }
  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[] { /* ... */ }
}
```

## API エンドポイント

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/strategies` | 全戦略一覧（未実装も含む） |
| GET | `/api/strategies/:id/ranking` | 指定戦略でのランキング |
| GET | `/api/stocks/:code` | 銘柄詳細 + スナップショット |
| GET | `/api/stocks/:code/history` | 財務履歴（最大8期） |
| GET | `/api/stocks/:code/strategies` | この銘柄の全activeストラテジースコア |
| GET | `/api/ranking/net-cash-ratio` | NCR降順ランキング（後方互換エイリアス） |
| POST | `/api/admin/sync` | 手動同期 |

## GitHub Actions

| ワークフロー | トリガ | 処理 |
|---|---|---|
| `collect.yml` | 月・木 09:00 JST、手動 | 静的JSON生成 → main にコミット |
| `deploy.yml` | `collect.yml` 完了後、main push | Vite ビルド → GitHub Pages デプロイ |

`collect.yml` は `DATA_PROVIDER=csv` で動作するため、J-Quants 未登録でも動く。  
Secrets `JQUANTS_MAIL_ADDRESS` + `JQUANTS_PASSWORD` を設定すれば自動で `jquants` モードに切替。

## 注意事項

本ツールは投資判断支援を目的とし、個別銘柄の推奨ではありません。  
投資に関する最終判断はご自身の責任で行ってください。

NetCash は清原流近似式（`現預金 − 負債合計`、投資有価証券は Phase 2 で補完）を使用しています。
