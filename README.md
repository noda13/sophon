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
| Phase 1b | J-Quants スケルトン（`JQuantsProvider` 実装） | **完了** |
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

## J-Quants 実データモード

### 認証形式

J-Quants は **APIキー方式ではありません**。メアド＋パスワードで認証します：

```
mail + password
  → POST /v1/token/auth_user       → refreshToken（1週間有効）
  → POST /v1/token/auth_refresh    → idToken（24h有効、実際のAPI呼出用）
```

`JQuantsProvider` は refreshToken と idToken を `backend/.cache/jquants-token.json` に自動永続化するため、毎回再認証は走りません。

### 初回セットアップ

1. https://jpx-jquants.com/ で Free tier 登録（メアド・パスワード設定のみ、クレカ不要）
2. `backend/.env` に以下を追記：
   ```
   DATA_PROVIDER=jquants
   JQUANTS_MAIL_ADDRESS=<あなたのメアド>
   JQUANTS_PASSWORD=<あなたのパスワード>
   ```
3. 接続テスト：
   ```bash
   pnpm -C backend exec tsx scripts/test-jquants.ts
   ```
   → トヨタ（7203）の最新財務・株価が取得できれば成功
4. 全同期：
   ```bash
   curl -X POST http://localhost:8902/api/admin/sync
   ```

**注意**：J-Quants Free tier は株価・財務とも **12週遅延** です。清原流のチェック頻度（月次〜四半期）なら実用上問題ありません。直近値が必要なら Light tier（月1,089円）へ。

## 楽天証券データ取得手順（スモールスタート運用）

清原流のスクリーニングは「**楽天証券スーパースクリーナーで一次足切り → waga-scope で清原流ランキング**」の2段階でやると効率的です。楽天証券口座があれば追加費用なしで四季報データにアクセス可能。

### 楽天 スーパースクリーナー CSV 取得（★一次足切り用）

**清原流に合う一次足切りの推奨条件**：

| 条件 | 推奨値 | 理由 |
|---|---|---|
| 時価総額 | 500億円以下 | 清原流の小型株ユニバース |
| PBR | 2.0以下 | バリュー株の基本ライン |
| 営業利益 | プラス | 赤字企業除外（CNPER計算不能を避ける） |
| 自己資本比率 | 40%以上（任意） | 財務健全性の初期スクリーン |

**手順**：

1. 楽天証券にログイン（https://www.rakuten-sec.co.jp/）
2. メニュー「**投資情報**」→「**スーパースクリーナー**」を開く
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

本ツールは投資判断支援を目的とし、個別銘柄の推奨ではありません。  
投資に関する最終判断はご自身の責任で行ってください。

NetCash は清原流近似式（`現預金 − 負債合計`、投資有価証券は Phase 2 で補完）を使用しています。
