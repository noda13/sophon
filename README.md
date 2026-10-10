# waga-scope — 清原流バリュー・スクリーナー

清原達郎『わが投資術』（2024）の投資哲学に基づき、**ネットキャッシュ比率**と**キャッシュニュートラルPER**でスクリーニングする日本小型株バリュースクリーナー。

## 免責事項

本ツールは情報提供のみを目的としており、投資助言、特定銘柄の推奨、売買の勧誘ではありません。
表示される指標とスコアは、公開データと簡易な近似式から機械的に算出した参考値です。
データの正確性、完全性、最新性は保証しません。
J-Quants の無料プランでは株価と財務が12週遅延するなど、データ源にも制約があります。
投資に関する最終判断と、その結果についての責任は、利用者自身が負うものとします。

## Stack

- Backend: Express 4 + Prisma 5 + Zod + TypeScript
- Frontend: React 19 + Vite + Tailwind + TanStack Query + Recharts + react-router
- DB: SQLite (Prisma)
- Ports: backend 8902, frontend 3902

## アーキテクチャ

データは次の流れで画面に届きます。

```
DataProvider（csv / jquants / db）
  → syncOrchestrator（取得・指標計算・SQLite へ保存）
  → Strategy（スコア計算とランキング）
  → Express API（/api/*）または 静的JSON（frontend/public/data/*.json）
  → React フロントエンド
```

- **DataProvider**：銘柄一覧と財務・株価の取得元を差し替える層です（`backend/src/providers/`）。`DATA_PROVIDER` で選びます。
- **syncOrchestrator**：Provider から取得したデータで NCR や CNPER などの指標を計算し、`Stock`、`FinancialStatement`、`ScreeningSnapshot` に保存します。`POST /api/admin/sync` と、毎日 17:00 JST の cron（`node-cron`）から呼ばれます。
- **Strategy**：指標から銘柄ごとのスコアを計算し、ランキングを返します（`backend/src/strategies/`）。
- **動的モードと静的モード**：フロントエンドは、バックエンドの API を呼ぶ動的モードと、`frontend/public/data/*.json` を読む静的モード（GitHub Pages / Vercel 向け）の2通りで動きます。切替は後述の `VITE_STATIC_DATA` で決まります。

## Phase Status

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 0 | CSV seed + ランキング1画面 | 完了 |
| Phase 1a | Strategy パターン + 50銘柄 + StockDetail + 静的JSON配信 | **完了** |
| Phase 1b | J-Quants スケルトン（`JQuantsProvider` 実装） | **完了** |
| Phase 1c | Graham / Buffett / Lynch / Dividend / Composite 戦略（`strategies/index.ts` に登録済み、すべて `active: true`） | **完了** |
| Phase 2 | EDINET XBRL + 証券会社CSV | 未着手 |
| Phase 3 | マルチ戦略ダッシュボード + バックテスト | 未着手 |

`DATA_PROVIDER=edinet` と `DATA_PROVIDER=composite` は Phase 2 の予定で、**現時点では実装されていません**。
設定すると `resolveProvider()` が `Unknown DATA_PROVIDER` で例外を投げ、同期は失敗します。
利用できる値は `csv`、`jquants`、`db` です。

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

## テスト

```bash
pnpm -C frontend test         # フロントエンド（vitest + Testing Library）
pnpm -C frontend type-check
```

## ワンショット同期スクリプト

バックエンド起動 → `/api/admin/sync` 発火 → 30秒おきに進捗表示 → 完了後に静的JSON生成 → バックエンド停止 を一括で実行：

```bash
# デフォルト（jquants 全銘柄同期 → DB から静的JSON生成）
bash scripts/full-sync.sh

# 部分同期で動作確認
MVP_STOCK_LIMIT=50 bash scripts/full-sync.sh

# CSV でローカル確認（J-Quants 不要）
DATA_PROVIDER=csv bash scripts/full-sync.sh

# 静的JSON生成をスキップ
SKIP_STATIC=1 bash scripts/full-sync.sh

# 静的JSON生成 → git push → GitHub Pages デプロイまで一発
PUSH_STATIC=1 bash scripts/full-sync.sh

# 静的JSONを CSV 50銘柄サンプルにする（デモ用）
STATIC_PROVIDER=csv PUSH_STATIC=1 bash scripts/full-sync.sh
```

Ctrl+C でバックエンドごと安全に停止。ログは `backend/.cache/{backend,sync}.log`。

## GitHub Pages 更新（週次デプロイ）

Pages は静的JSON（J-Quants 全銘柄、約3,757銘柄）をビルドして配信する。GHA の `deploy.yml` が `frontend/` への push を検知してデプロイする。

**週次更新の手順（ローカルで実行するだけ）：**

```bash
# J-Quants 全銘柄同期 → 静的JSON生成 → git push → GitHub Pages デプロイ（推奨）
PUSH_STATIC=1 bash scripts/full-sync.sh

# 同期なし・DBのデータをそのまま静的JSON化してpush（DB更新不要なとき）
DATA_PROVIDER=db PUSH_STATIC=1 bash scripts/full-sync.sh
```

push すると GHA `deploy.yml` が自動起動し、数分で GitHub Pages に反映される。

## 静的JSON生成（単体）

```bash
# DBから全銘柄（J-Quants 同期済みが前提）
DATABASE_URL="file:./prisma/dev.db" DATA_PROVIDER=db pnpm exec tsx scripts/collect-static.ts

# CsvProvider（J-Quants 未登録でもOK、50銘柄サンプル）
DATA_PROVIDER=csv pnpm exec tsx scripts/collect-static.ts
# → frontend/public/data/*.json に出力
```

## DATA_PROVIDER の切替

| 値 | 説明 |
|---|---|
| `csv` | `backend/seed/stocks.csv` から読込。J-Quants 不要。デフォルト |
| `jquants` | J-Quants API 利用（`.env` に認証情報が必要） |
| `db` | SQLite DBから読込（J-Quants 同期済みデータを静的JSON化するときに使用） |
| `edinet` | **未実装**（Phase 2 予定）。指定すると同期時にエラーになる |
| `composite` | **未実装**（Phase 2 予定）。指定すると同期時にエラーになる |

```bash
# .env または環境変数で指定
DATA_PROVIDER=csv         # サンプルデータ（デフォルト）
DATA_PROVIDER=jquants     # 実データ（Phase 1b 実装後）
```

J-Quants を使うには https://jpx-jquants.com/ でFree tier 登録後、`.env` に設定：

```
JQUANTS_API_KEY=<ダッシュボードで発行したAPIキー>
```

## Strategy パターン

### Phase 1 実装：清原流（`KiyoharaStrategy`）

| 指標 | 役割 |
|---|---|
| NCR（ネットキャッシュ比率） | 1.0超で超割安水準。スコアの主成分（0-80点） |
| CNPER（キャッシュニュートラルPER） | 0〜10倍で加点、20倍超で減点（-15〜+20点） |
| 時価総額 | 500億超でペナルティ（-10点）、50億以下でボーナス（+5点） |
| 赤字（profit ≤ 0） | スコア上限50点 |

### 新しい Strategy の追加方法

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

ベースパスは `/api` です。
エラーは `{ "error": "<メッセージ>" }` の JSON で返ります（400: クエリ不正、404: 対象なし、500: 内部エラー）。

### 戦略・ランキング

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/strategies` | 全戦略のメタ情報（`id`、`displayName`、`description`、`active`） |
| GET | `/api/strategies/:id/ranking` | 指定戦略のランキング。存在しない `id` は 404、`active` でない戦略は 400 |
| GET | `/api/ranking/net-cash-ratio` | NCR 降順ランキング（後方互換エイリアス） |
| GET | `/api/ranking/cash-neutral-per` | CNPER 順ランキング（後方互換エイリアス） |

`/api/strategies/:id/ranking` のクエリ：

| パラメータ | 型 | 既定値 | 説明 |
|---|---|---|---|
| `limit` | 整数 1〜200 | 50 | 取得件数 |
| `maxMarketCap` | 正の数 | `MARKET_CAP_MAX_YEN` | 時価総額の上限（円） |
| `minMarketCap` | 正の数 | なし | 時価総額の下限（円） |
| `excludeSectors` | カンマ区切り文字列 | なし | 除外する33業種名 |

`/api/ranking/*` は `limit`（既定 50、1〜200）と `maxMarketCap` を受け付けます。

### 銘柄

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/stocks` | 銘柄一覧（最新スナップショット付き） |
| GET | `/api/stocks/:code` | 銘柄詳細（最新スナップショットと直近8期の財務） |
| GET | `/api/stocks/:code/history` | 財務履歴（直近8期） |
| GET | `/api/stocks/:code/strategies` | 当該銘柄の全 active 戦略スコア |

`:code` は英数字大文字4桁（例：`7203`）です。
`/api/stocks` のクエリは `limit`（既定 50、1〜200）、`sector`（33業種名の部分一致）、`orderBy`（`code` / `name` / `marketCap`、既定 `code`）です。

### 管理

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/admin/sync` | 手動同期。同期中は 409 |
| GET | `/api/admin/status` | 同期中かどうか、直近の収集ログ、銘柄数とスナップショット数 |

`ADMIN_TOKEN` を設定すると、`/api/admin/*` は `Authorization: Bearer <ADMIN_TOKEN>` が必須になります（不一致は 401）。
`NODE_ENV=production` で `ADMIN_TOKEN` が未設定の場合、管理エンドポイントは 503 を返して無効になります。

```bash
curl -X POST http://localhost:8902/api/admin/sync -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 環境変数

### バックエンド（`.env.example` を `backend/.env` にコピーして使う）

| 変数 | 既定値 | 説明 |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Prisma の接続先（SQLite） |
| `DATA_PROVIDER` | `csv` | `csv` / `jquants` / `db`。`edinet` / `composite` は未実装 |
| `JQUANTS_API_KEY` | 空 | J-Quants V2 の API キー。`jquants` 利用時に必須 |
| `JQUANTS_REQ_INTERVAL_MS` | `13000` | J-Quants へのリクエスト間隔（ms）。Free プランの安全値 |
| `JQUANTS_MAIL_ADDRESS` | 空 | V1 の旧認証。V2 では使われない |
| `JQUANTS_PASSWORD` | 空 | V1 の旧認証。V2 では使われない |
| `PORT` | `8902` | バックエンドの待受ポート |
| `NODE_ENV` | `development` | `production` では `ALLOWED_ORIGINS` が必須になり、未設定だと起動時に終了する |
| `ALLOWED_ORIGINS` | 空 | CORS で許可するオリジン（カンマ区切り）。開発時に空なら全オリジンを許可 |
| `ADMIN_TOKEN` | 空 | `/api/admin/*` の Bearer トークン。本番では未設定だと管理 API が無効になる |
| `MARKET_CAP_MAX_YEN` | `50000000000` | ランキングで使う時価総額の既定上限（500億円） |
| `NET_CASH_RATIO_MIN` | `0.3` | `config` に読み込まれるが、現状のランキング処理では参照されていない |
| `MVP_STOCK_LIMIT` | `30` | 同期で処理する銘柄数の上限（動作確認用。`scripts/full-sync.sh` は未指定時に `0`） |
| `TZ` | `Asia/Tokyo` | タイムゾーン。cron は `Asia/Tokyo` 固定 |

### フロントエンド（ビルド時に埋め込まれる）

| 変数 | 既定値 | 説明 |
|---|---|---|
| `VITE_STATIC_DATA` | 未設定 | `true` で静的JSONモード、`false` で API モード。未設定なら開発サーバーは API モード、本番ビルドは静的モード |
| `VITE_BASE_PATH` | `/` | 配信パス。GitHub Pages では `/waga-scope/` |
| `VITE_API_URL` | `http://localhost:8902` | 開発サーバー（Vite）が `/api` をプロキシする先 |

### 本番サーバー配備での注意（`VITE_STATIC_DATA`）

`VITE_STATIC_DATA` が未設定のとき、本番ビルド（`vite build`）は静的JSONモードになります。
GitHub Pages と Vercel の静的配信ではこの挙動を前提にしているため、既定値は変えていません。
一方で、本番ビルドをバックエンドと一緒に配備する場合は、`VITE_STATIC_DATA=false` を指定してビルドしないと、フロントエンドが `/api` を呼ばず `/data/*.json` を読みにいきます。
その結果、画面は空かエラーになります。

```bash
VITE_STATIC_DATA=false pnpm -C frontend build
```

`VITE_STATIC_DATA` は `vite build` 時に埋め込まれるため、ビルド後に環境変数を変えても反映されません。
本番ビルドでの `VITE_STATIC_DATA=false` は明示指定として尊重されます。

## GitHub Actions

| ワークフロー | トリガ | 処理 |
|---|---|---|
| `collect.yml` | 手動のみ（`workflow_dispatch`） | 静的JSON生成 → main にコミット（GHA節約のため無効化中） |
| `deploy.yml` | `frontend/` への push、手動 | Vite ビルド → GitHub Pages デプロイ |

静的JSONの更新は手元で行い、push すると `deploy.yml` が自動起動する（上記「GitHub Pages 更新」参照）。  
Secrets `JQUANTS_API_KEY` を設定すれば自動で `jquants` モードに切替（V2 API）。

## J-Quants 実データモード（V2 API）

J-Quants は 2025-12-22 以降 V2 API に移行し、認証方式が **API Key** に変更されました。

### セットアップ

1. https://jpx-jquants.com/ で Free tier 登録 → メール認証完了
2. ダッシュボード左メニュー「API Key」→「API Keyを発行」ボタン
3. 発行されたキーをコピーし `backend/.env` に追記：
   ```
   DATA_PROVIDER=jquants
   JQUANTS_API_KEY=<コピーしたキー>
   ```
4. 接続確認（実レスポンス構造の確認）：
   ```bash
   pnpm -C backend exec tsx scripts/test-jquants.ts --discover
   ```
5. 本番テスト：
   ```bash
   pnpm -C backend exec tsx scripts/test-jquants.ts
   ```
6. 全銘柄同期：
   ```bash
   curl -X POST http://localhost:8902/api/admin/sync
   ```

### レート制限・プラン別所要時間

J-Quants API の公式レート制限（[docs](https://jpx-jquants.com/en/spec/rate-limits)）：

| Plan | 制限 | JQUANTS_REQ_INTERVAL_MS | 全銘柄同期（約3,900銘柄）|
|---|---|---|---|
| **Free**（デフォルト）| **5 req/min** | 13000 | 約18〜20分 |
| Light（¥1,089/月）| 60 req/min | 1100 | 約2分 |
| Standard | 120 req/min | 600 | 約1分 |

**重要**：「significantly exceeding the rate limit」で **5分間の完全ブロック**が発生します。上記の間隔を守ってください（defaultの `13000ms` は Free tier 用の安全値）。

Light tier 以上を使う場合：
```
# backend/.env
JQUANTS_API_KEY=<key>
JQUANTS_REQ_INTERVAL_MS=1100   # Light tier用
```

### データ遅延

- **Free / Light**: 株価・財務ともに **12週遅延**
- **Standard / Premium**: より短い遅延（プラン詳細参照）

### バッチエンドポイント活用（Free tier でも実用）

`syncOrchestrator` は `/v2/fins/summary?date=YYYYMMDD` と `/v2/equities/bars/daily?date=YYYYMMDD` の**日付ベース**バッチで、1 API callあたり数千銘柄分のデータを取得します。これにより per-code で 8000 API call 必要なところを約90 call に圧縮しています（Free tier で全市場同期が現実的になる）。

## 楽天証券データ取得手順（スモールスタート運用）

清原流のスクリーニングは「**楽天証券スーパースクリーナーで一次足切り → waga-scope で清原流ランキング**」の2段階でやると効率的です。楽天証券口座があれば追加費用なしで四季報データにアクセス可能。

### 楽天 スーパースクリーナー CSV 取得（★一次足切り用）

**清原流に合う一次足切りの推奨条件**：

| 条件 | 推奨値 | 理由 |
|---|---|---|
| 時価総額 | 500億円以下 | 清原流の小型株ユニバース |
| 当期純利益 or 営業利益 | プラス | 赤字企業除外（CNPER計算不能を避けるため） |
| 自己資本比率（任意） | 40%以上 | 財務健全性の初期スクリーン |
| 現金同等物/時価総額（あれば） | 高いほど良い | NCR の擬似指標、楽天にこの項目があれば有効活用 |

**重要**：清原流は **PBR / ROE / 配当利回り を主軸にしません**（PBRは「帳簿上の純資産は信用できない、現金だけが信頼できる」という思想と相反する）。楽天スクリーナーは**時価総額＋利益プラス**の粗い足切りで十分、**本選別は waga-scope の NCR ランキング**で行います。

**手順**：

1. 楽天証券にログイン（https://www.rakuten-sec.co.jp/）
2. グローバルメニュー「**国内株式**」→「**スーパースクリーナー**」を開く
   （※楽天証券はUI変更が多いので、見つからなければ検索ボックスで「スクリーナー」検索）
3. 条件を設定：
   - 時価総額：`5,000,000百万円以下` （500億）
   - PBR（実績）：`2.0以下`
   - 営業利益：`プラス`
   - 他、好みで ROE, 配当利回りなど追加
4. 「検索」→ 結果画面右上の「**CSVダウンロード**」
5. ダウンロードしたCSVを `backend/data/user/rakuten-screener-YYYYMMDD.csv` に保存
   （`backend/data/user/` は `.gitignore` 済み）

### 楽天 保有商品一覧 CSV 取得（自分のポートフォリオ認識）

**手順**：

1. 楽天証券ログイン後、トップ画面「**保有商品一覧**」
2. 「**国内株式**」タブ → 右上「**CSVダウンロード**」
3. `backend/data/user/rakuten-holdings-YYYYMMDD.csv` に保存

取得できる項目：銘柄コード、銘柄名、保有数量、平均取得単価、現在値、評価損益

### 楽天 取引履歴 CSV 取得（過去トレード参照用、任意）

**手順**：

1. 「**口座管理**」→「**取引履歴**」
2. 期間指定（最大過去2年）→「**CSVダウンロード**」
3. `backend/data/user/rakuten-trades-YYYYMMDD.csv` に保存

### SBI 証券 の場合（併用者向け）

| CSV | 取得場所 |
|---|---|
| 保有銘柄 CSV | ログイン → ポートフォリオ → CSVエクスポート |
| 銘柄スクリーナー CSV | 投資情報 → スクリーニング → CSV出力（楽天より項目数は少ない）|
| 取引履歴 CSV | 口座管理 → 取引履歴 → 期間指定 → CSV |

### CSV の活用タイミング

- 現状（Phase 1）：**CSVをローカル保管しておくだけでOK**。実際にアプリに取り込むのは Phase 2 で実装予定
- Phase 2（近日実装）：`POST /api/portfolio/import` で CSV アップロード → フォーマット自動判定（楽天/SBI、保有/スクリーナー）→ 銘柄候補リスト / 保有状況として画面に反映

### 推奨ワークフロー（Phase 2 完成後のイメージ）

```
月初 or 決算シーズン（2/5/8/11月）
  ↓
楽天スーパースクリーナーで一次足切り（~300銘柄）→ CSV DL
  ↓
waga-scope に CSV import
  ↓
J-Quants から該当銘柄の財務データ取得 → 清原流ランキング計算
  ↓
上位10〜20銘柄を吟味 → EDINET で有報スポット確認
  ↓
購入後：楽天保有銘柄CSVを再インポート → 画面でハイライト表示
```

### 規約上やらないこと

- 楽天/SBIへの自動ログイン（Playwright等）→ 規約違反
- 非公開APIの逆リバース → 規約違反
- **あくまでユーザーが手動DLしたCSVをアプリが読む**範囲内で運用

## 注意事項

投資に関する免責事項は冒頭の「免責事項」を参照してください。

NetCash は清原流近似式（`現預金 − 負債合計`、投資有価証券は Phase 2 で補完）を使用しています。
