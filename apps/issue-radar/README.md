# Issue Radar — 社会課題収集・分析ダッシュボード

Twitter（X）と各メディアから社会課題を自動収集し、LLMで分類・スコアリング・アプリ化アイデアを生成するダッシュボード。「アプリで解決できそうな課題」を発見し、解決アプリの企画につなげることが目的。

## 主な機能

- **自動収集**: 国内外のニュースRSS + Twitter/X（RSSHub経由）から6時間ごとに課題を収集
- **LLM分類**: カテゴリ・深刻度・緊急度・アプリ化可能性を自動スコアリング
- **アイデア生成**: アプリ化可能性60点以上の課題に対してMVP機能・ターゲット・難易度を自動提案
- **0円運用**: GitHub Actions + GitHub Pages でサーバー不要、API費用も無料枠内

## 課題カテゴリ

| カテゴリID | 表示名 |
|---|---|
| `employment_economy` | 雇用・経済 |
| `healthcare_welfare` | 医療・福祉 |
| `education` | 教育・学習 |
| `childcare_family` | 子育て・家族 |
| `aging_care` | 高齢化・介護 |
| `governance` | 行政・制度 |
| `environment_disaster` | 環境・防災 |
| `community_regional` | 地方・コミュニティ |

## テックスタック

| レイヤー | 技術 |
|---|---|
| 言語/ランタイム | TypeScript + Node.js 22 (ESM) |
| パッケージ管理 | pnpm 10 (workspaces) |
| フロントエンド | React 19 + Vite + TanStack Query + Tailwind CSS |
| バックエンド (ローカル) | Express + Prisma + SQLite |
| LLM | Groq (メイン) + Gemini (フォールバック) |
| デプロイ | GitHub Pages + GitHub Actions cron |

## セットアップ

### A. GitHub Pages（推奨・0円運用）

1. このリポジトリをフォーク
2. Secrets を設定 (`Settings > Secrets and variables > Actions`)
   - `GROQ_API_KEY` — [console.groq.com](https://console.groq.com) で取得（無料）
   - `GEMINI_API_KEY` — （任意、フォールバック用）
   - `LLM_PROVIDER` — `groq`
   - `RSSHUB_URL` — （任意、デフォルト: `https://rsshub.app`）
3. `Settings > Pages > Source: GitHub Actions` に変更
4. `Actions > Collect Issues > Run workflow` で手動収集
5. `Actions > Deploy to GitHub Pages > Run workflow` でデプロイ

### B. Docker（ローカル開発）

```bash
cp .env.example .env  # GROQ_API_KEY を記入
docker compose up -d --build
# frontend: http://localhost:3902
# backend:  http://localhost:8902
```

手動収集:
```bash
curl -X POST http://localhost:8902/api/admin/collect
```

### C. pnpm（ローカル開発・DBなし静的モード）

```bash
pnpm install
cd backend
DATABASE_URL="file:./prisma/dev.db" pnpm exec prisma migrate dev --name init
DATABASE_URL="file:./prisma/dev.db" pnpm run prisma:seed
cd ..
pnpm dev
```

静的収集（GitHub Actions相当）:
```bash
pnpm collect  # frontend/public/data/*.json を生成
```

## 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GROQ_API_KEY` | ◎ | Groq API キー（無料枠大） |
| `GEMINI_API_KEY` | △ | Gemini API キー（フォールバック） |
| `LLM_PROVIDER` | — | `groq` or `gemini` (自動検出) |
| `RSSHUB_URL` | — | RSSHub インスタンスURL（デフォルト: rsshub.app） |
| `DATABASE_URL` | ローカルのみ | SQLite ファイルパス |
| `PORT` | ローカルのみ | バックエンドポート（デフォルト: 8902） |

## ニュースソース

| ソース | タイプ |
|---|---|
| Yahoo!ニュース (国内) | news_jp |
| 朝日新聞 | news_jp |
| NHK | news_jp |
| 日本経済新聞 | news_jp |
| Reuters | news_global |
| BBC | news_global |
| The Guardian | news_global |
| The New York Times | news_global |
| 内閣府 | gov |
| Twitter/X（RSSHub経由） | twitter |

Twitter アカウントの追加・削除は `backend/src/services/issueCollector.ts` の `RSS_SOURCES` 配列を編集してください。

## データフロー

```
RSS / RSSHub (Twitter)
  ↓ 6時間ごと (GitHub Actions)
scripts/collect-static.ts
  ↓ Step 1: RSS 収集 → 重複排除 → 最新300件
  ↓ Step 2: LLM分類 (バッチ10件) → カテゴリ・スコアリング
  ↓ Step 3: LLM アイデア生成 (appifiability≥60のみ)
  ↓
frontend/public/data/
  ├── issues.json          (全課題)
  ├── ideas.json           (アイデア付き課題)
  ├── category-summary.json
  └── meta.json
  ↓
GitHub Pages (静的ホスティング)
```

## コスト

| 項目 | 費用 |
|---|---|
| GitHub Actions | 無料 (2,000分/月) |
| GitHub Pages | 無料 |
| Groq API | 無料枠: llama-3.3-70b 1M tokens/日 |
| Gemini API | 無料枠: 1,000 requests/日 |
| **合計** | **$0/月** |
