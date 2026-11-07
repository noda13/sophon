# Econoguard - グローバル経済リスクモニター

グローバルな経済リスクを自動収集・AI分析・可視化するダッシュボード。RSSフィードと経済指標データを収集し、LLMで日本語要約とリスクスコアリングを行う。完全無料で運用可能。

**本番URL**: https://noda13.github.io/econoguard/

---

## 主な機能

- **ニュース自動収集**：Bloomberg、CNBC、MarketWatch、WSJ、FT、The Economist、FRB、ECB、日銀、日経の10件のRSSフィードを取得
- **経済指標モニタリング**：NYダウ、S&P500、TOPIX（ETF）、ドル円、VIX、米10年債利回り、米3ヶ月債利回り、WTI原油、金、HY社債ETFの10指標をYahoo Financeから取得
- **AI分析**：LLMでニュースを日本語要約し、4カテゴリのリスクスコアを算出
- **ダッシュボード**：総合リスク指数、カテゴリ別リスク、推移チャート、経済指標、今後の経済イベント、ニュースフィードを一画面に表示。ヘッダーのプロフィール設定（年齢、監視感度、資産配分）を入力すると、ポートフォリオへの影響も表示する（プロフィールはブラウザのlocalStorageに保存）

## PWA

ホーム画面に追加してアプリのように起動できる（PWA）。
経済データ（`/data/*.json`）はネットワーク優先で取得し、オフライン時は最後に取得したキャッシュを最大 7 日間閲覧できる。
プッシュ通知は非対応。

---

## リスクカテゴリ

| カテゴリ | Slug | 監視対象 |
|---|---|---|
| 通貨・金融 | `currency_finance` | 為替、金利、インフレ、銀行危機、CBDC |
| 地政学・供給網 | `geopolitics_supply_chain` | 貿易摩擦、制裁、エネルギー、食料安全保障 |
| テクノロジー | `technology` | AI規制、サイバー攻撃、半導体供給 |
| 社会・政策 | `social_policy` | 中央銀行政策、財政政策、人口動態 |

---

## Tech Stack

| レイヤー | 技術 |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Recharts, TanStack Query |
| Backend (local) | Express, Prisma, SQLite |
| LLM | 本番（静的収集）: Groq / Gemini / OpenAI / 任意のOpenAI互換API（設定で切替）。ローカルバックエンド: Gemini / Ollama |
| Data Sources | 本番: RSS feeds (10ソース) + Yahoo Finance。ローカルバックエンド: RSS feeds (同じ10ソース) + FRED / Open Exchange Rates / CoinGecko / Yahoo Finance |
| CI/CD | GitHub Actions (手動実行) + GitHub Pages |
| Test | Vitest |

---

## セットアップ

### 1. LLM APIキーの取得（いずれか1つ）

GitHub Actions（本番）で使うキー。ローカルバックエンドは Gemini（または Ollama）だけを使う（[ローカルバックエンドの LLM](#ローカルバックエンドの-llm) を参照）。

| プロバイダー | 無料枠 | APIキー取得 |
|---|---|---|
| **Groq（推奨）** | 14,400リクエスト/日 | https://console.groq.com/keys でアカウント作成 → 「Create API Key」 |
| Gemini | 1,500リクエスト/日 | https://aistudio.google.com/apikey → 「Create API key in new project」 |
| OpenAI | なし（有料） | https://platform.openai.com/api-keys |
| その他 | 各社による | `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL` で任意のOpenAI互換APIを指定可能 |

GitHub Actions のワークフローが受け取るキーは `GROQ_API_KEY` と `GEMINI_API_KEY` だけである。
OpenAI と任意のOpenAI互換APIは、ローカルで `pnpm collect` を実行するときだけ使える。

### 2. GitHub Pages（本番デプロイ）

```bash
# 1. リポジトリをクローン
git clone https://github.com/noda13/econoguard.git

# 2. GitHub Secrets を設定（Settings > Secrets and variables > Actions）
#    以下のいずれかを設定:
#    - GROQ_API_KEY（推奨）
#    - GEMINI_API_KEY
#    - 両方設定した場合、LLM_PROVIDER で優先を指定可能

# 3. GitHub Pages を有効化
#    Settings > Pages > Source: GitHub Actions

# 4. 手動でデータ収集を実行
#    Actions タブ > Collect Economic Data > Run workflow
#    収集とコミットの後に Deploy to GitHub Pages が呼び出され、サイトが更新される

# 5. サイトにアクセス
#    https://noda13.github.io/econoguard/
```

ワークフローはすべて `workflow_dispatch`（手動実行）だけで動く。
GitHub Actions の利用時間を抑えるため、定期実行は設定していない。
サイトの内容は、最後に Collect Economic Data を実行した時点のまま変わらない。

### 3. ローカル開発（Docker）

```bash
cp .env.example .env
# .env を編集する
#   ADMIN_SECRET: 管理API用の任意の文字列（収集の手動実行に必要）
#   GEMINI_API_KEY: LLM用（未設定でOllamaが起動していればOllamaを使う）

docker compose up -d
# http://localhost:3901 でアクセス

# 初回・設定変更後はイメージ再ビルド
docker compose up -d --build

# 手動でデータ収集を開始（202 が即座に返り、収集はバックグラウンドで続く）
curl -X POST http://localhost:8901/api/admin/collect -H "X-Admin-Key: <ADMIN_SECRET の値>"

# 進捗と結果を確認
curl http://localhost:8901/api/admin/status -H "X-Admin-Key: <ADMIN_SECRET の値>"
```

バックエンドのコンテナは uid 1000（`node` ユーザー）で動き、bind mount した `backend/prisma` に `dev.db` やマイグレーション結果を書き込む。
Mac の Docker Desktop では、所有者の調整は不要である。
Linux ホストで自分の uid が 1000 でない場合や、以前の root コンテナが作った root 所有の `dev.db` が残っている場合は、起動前に所有者を変更する。

```bash
sudo chown -R 1000:1000 backend/prisma
```

コンテナに渡る環境変数は、`docker-compose.yml` に列挙したものだけである（`.env` に書いても、列挙されていない変数はコンテナに届かない）。
`ADMIN_SECRET` が空のとき、`/api/admin/*` は 503 を返す。

### 4. ローカル開発（pnpm）

```bash
pnpm install

# Backend
cd backend
cp ../.env.example .env   # ADMIN_SECRET と GEMINI_API_KEY 等を設定
npx prisma migrate dev
npx tsx prisma/seed.ts
pnpm dev

# Frontend（別ターミナル）
cd frontend
pnpm dev
```

データ収集の手動実行は Docker と同じ手順で、`http://localhost:8901/api/admin/collect` に `X-Admin-Key` ヘッダー付きで POST する。

---

## LLM 設定

### 環境変数によるプロバイダー切替

以下は静的データ収集（`scripts/collect-static.ts`）の設定。
ローカルバックエンドはこれらの変数を読まない。

```bash
# --- 方法1: プロバイダー固有のキーを設定（自動検出） ---
GROQ_API_KEY=gsk_xxxx          # → 自動で Groq (llama-3.3-70b) を使用
GEMINI_API_KEY=AIxxxx           # → 自動で Gemini (gemini-flash-latest) を使用
OPENAI_API_KEY=sk-xxxx          # → 自動で OpenAI (gpt-4o-mini) を使用

# --- 方法2: 明示的にプロバイダーを指定 ---
LLM_PROVIDER=groq               # 複数キーがある場合に優先プロバイダーを指定

# --- 方法3: 任意のOpenAI互換APIを使用 ---
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.together.xyz/v1
LLM_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo
```

### プリセット一覧

| プロバイダー | デフォルトモデル | 自動検出キー |
|---|---|---|
| Groq | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Gemini | `gemini-flash-latest` | `GEMINI_API_KEY` |
| OpenAI | `gpt-4o-mini` | `OPENAI_API_KEY` |

Together や OpenRouter などのOpenAI互換APIには、デフォルトモデルがない。
方法3のとおり `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` をすべて指定する。
`LLM_MODEL` を省略すると、モデル名として `default` が送られる。

### ローカルバックエンドの LLM

ローカルバックエンドは次の順でプロバイダーを選ぶ。

1. `GEMINI_API_KEY` が設定されていれば Gemini（モデルは `GEMINI_MODEL`、既定は `gemini-flash-latest`）を使う。
2. 未設定で、`OLLAMA_BASE_URL` の Ollama に到達できれば Ollama（モデルは `OLLAMA_MODEL`、既定は `qwen2.5:7b`）を使う。
3. どちらも使えなければ、要約とリスク評価は失敗する。ニュースと指標の収集は続き、収集ログの `status` は `partial` になる。

### GitHub Actions での設定

GitHub Secrets（Settings > Secrets and variables > Actions）に以下を追加:

| Secret名 | 説明 |
|---|---|
| `GROQ_API_KEY` | Groq APIキー（推奨） |
| `GEMINI_API_KEY` | Gemini APIキー（オプション） |
| `LLM_PROVIDER` | 優先プロバイダー（オプション、複数キーがある場合） |

---

## 環境変数一覧

「静的収集」は `scripts/collect-static.ts`（GitHub Actions、またはローカルの `pnpm collect`）、「ローカルバックエンド」は `backend/` の Express API を指す。
静的収集の変数は、GitHub Actions では Secrets から渡す。ローカルの `pnpm collect` ではシェルの環境変数に設定する（スクリプトは `.env` を読み込まない）。
ローカルバックエンドの変数は `.env` に書く（Docker では `docker-compose.yml` に列挙されたものだけが渡る）。

| 変数名 | 対象 | 必須 | 説明 |
|---|---|---|---|
| `GROQ_API_KEY` | 静的収集 | いずれか1つ | Groq APIキー |
| `GEMINI_API_KEY` | 静的収集、ローカルバックエンド | いずれか1つ | Google AI Studio APIキー |
| `OPENAI_API_KEY` | 静的収集 | いずれか1つ | OpenAI APIキー |
| `LLM_PROVIDER` | 静的収集 | No | 優先プロバイダー (`groq`, `gemini`, `openai`) |
| `LLM_BASE_URL` | 静的収集 | No | カスタムAPIエンドポイント。`LLM_API_KEY` と両方を指定するとカスタムエンドポイントを使う |
| `LLM_MODEL` | 静的収集 | No | モデル名の上書き。`LLM_PROVIDER` 指定時とカスタムエンドポイント使用時に有効。Gemini は常にこの値を参照する |
| `LLM_API_KEY` | 静的収集 | No | カスタムエンドポイント用のAPIキー |
| `GEMINI_MODEL` | ローカルバックエンド | No | Gemini のモデル名（既定 `gemini-flash-latest`） |
| `OLLAMA_BASE_URL` | ローカルバックエンド | No | Ollama のエンドポイント（既定 `http://host.docker.internal:11434`）。`GEMINI_API_KEY` が未設定のときに使う |
| `OLLAMA_MODEL` | ローカルバックエンド | No | Ollama のモデル名（既定 `qwen2.5:7b`） |
| `FRED_API_KEY` | ローカルバックエンド | No | FRED経済データAPI。未設定だと FRED 由来の4指標（VIX、米国CPI、米国政策金利、米10年国債利回り）を取得しない |
| `OPENEXCHANGERATES_APP_ID` | ローカルバックエンド | No | Open Exchange Rates の APP ID。未設定だとドル円を取得しない |
| `NEWSAPI_KEY` | ローカルバックエンド | No | NewsAPI（RSSに加える追加ニュースソース） |
| `ADMIN_SECRET` | ローカルバックエンド | `NODE_ENV=production` で必須 | `/api/admin/*` の認証キー。リクエストの `X-Admin-Key` ヘッダーで送る。未設定だと管理APIは 503 を返す |
| `ALLOWED_ORIGINS` | ローカルバックエンド | `NODE_ENV=production` で必須 | CORSで許可するオリジン（カンマ区切り）。開発時は未設定で全オリジンを許可する |
| `DATABASE_URL` | ローカルバックエンド | pnpm で必須 | SQLite のパス（例: `file:./dev.db`）。Docker では `docker-compose.yml` が設定する |

---

## ニュースソース

### 現在の収集ソース（10件）

| カテゴリ | ソース |
|---|---|
| 日本語 | BOJ, 日経 |
| 海外メディア | Bloomberg, CNBC, MarketWatch, WSJ, FT, The Economist |
| 中央銀行 | FRB, ECB |

Reuters は公開RSSを確認できなかったため含めていない。

静的収集は、LLMが付けた関連度スコアが30以上の記事（と、まだ要約されていない記事）だけを `news.json` に残す。
取得できていても関連度の低いソースは、ダッシュボードにほとんど表示されない。

### ソース設定ファイル

| ファイル | 用途 |
|---|---|
| `scripts/lib/news.ts` | GitHub Actions（本番） |
| `backend/src/services/newsCollector.ts` | Docker／pnpm（ローカル開発） |

RSSフィードの追加は、上記2つのファイルの `RSS_SOURCES` 配列に同じソースを追加する。
`scripts/lib/news.ts` は `{ url: '...', source: 'name' }`、`newsCollector.ts` は `{ name: 'name', url: '...', source: 'name' }` の形式である。
追加する前に、URLがHTMLではなくRSS/Atomを返し、最近の記事を含むことを `curl` で確認する。

---

## 経済指標

### 本番（GitHub Actions）

`scripts/lib/indicators.ts` が Yahoo Finance から次の10指標を取得する。
取得に失敗した指標は前回値を引き継ぎ、ダッシュボードに「更新停止」バッジが付く。

| コード | 指標 | Yahoo Finance シンボル |
|---|---|---|
| `DJIA` | NYダウ | `^DJI` |
| `SPX` | S&P500 | `^GSPC` |
| `TOPIX` | TOPIX(ETF) | `1306.T` |
| `USDJPY` | ドル円 | `USDJPY=X` |
| `VIX` | 恐怖指数(VIX) | `^VIX` |
| `UST10Y` | 米10年債利回り | `^TNX` |
| `UST3M` | 米3ヶ月債利回り | `^IRX` |
| `WTI` | 原油(WTI) | `CL=F` |
| `GOLD` | 金 | `GC=F` |
| `HYG` | HY社債ETF | `HYG` |

本番は CoinGecko を使わない。

### ローカルバックエンド

`backend/src/services/indicatorCollector.ts` が次の8指標を取得する。
キーが必要な指標は、キーが未設定だと取得をスキップする。

| コード | 指標 | ソース | 必要なキー |
|---|---|---|---|
| `VIX` | VIX恐怖指数 | FRED (`VIXCLS`) | `FRED_API_KEY` |
| `US_CPI` | 米国CPI（前年比） | FRED (`CPIAUCSL`) | `FRED_API_KEY` |
| `US_FFR` | 米国政策金利 | FRED (`FEDFUNDS`) | `FRED_API_KEY` |
| `US10Y` | 米10年国債利回り | FRED (`DGS10`) | `FRED_API_KEY` |
| `GOLD` | 金価格 | Yahoo Finance (`GC=F`) | 不要 |
| `USDJPY` | ドル円 | Open Exchange Rates | `OPENEXCHANGERATES_APP_ID` |
| `BTC` | ビットコイン | CoinGecko | 不要 |
| `ETH` | イーサリアム | CoinGecko | 不要 |

---

## 経済イベントカレンダー

FOMC、ECB理事会、日銀金融政策決定会合、米雇用統計、米CPI、米GDP速報値、日本GDP速報値の日程は、`scripts/economic-events.ts` に手書きで登録している。
外部APIからは取得しない。

登録済みなのは2026年分と2027年分（GDP速報値は2026年分のみ）で、毎年、新しい年の日程を追加する必要がある。末尾の日付まで残り60日を切ると、収集時にログへ警告が出る。
FOMCとECBの日付は公式カレンダーで確認した。
日銀会合、米雇用統計、CPI、米GDP速報値の2026年分も、公式カレンダーで確認した。
未確認なのは、日本GDP速報値（2026年11月16日を除く）である。
FOMCの2027年分は、Fedが暫定扱いにしている。

静的収集は、実行のたびに今後30日以内のイベントを `events.json` に書き出す。
ダッシュボードはその中から今日以降のイベントを表示する。
イベントは静的データ（本番）だけが対象で、ローカルバックエンドでは未実装のため、イベント欄は空になる。

---

## ディレクトリ構成

```
econoguard/
├── frontend/               # React ダッシュボード
│   └── public/data/        # 収集済みJSON（Collect Economic Data ワークフローが更新）
├── backend/                # Express API（ローカル開発用）
├── scripts/
│   ├── collect-static.ts   # 静的データ収集スクリプト（本番）
│   ├── economic-events.ts  # 経済イベントの日程（年次で手動更新）
│   ├── lib/                # 収集処理（ニュース、指標、要約、リスク評価、総合指数、イベント抽出）
│   └── tsconfig.json       # scripts の型チェック設定
├── .github/workflows/
│   ├── collect.yml         # データ収集（手動実行）。完了後に deploy.yml を呼び出す
│   ├── deploy.yml          # GitHub Pages デプロイ（手動実行、または collect.yml から呼び出し）
│   └── ci.yml              # 型チェックとビルド（手動実行）
├── vitest.config.ts        # テスト設定
└── docker-compose.yml      # ローカル開発環境
```

---

## データ収集フロー

```
[手動トリガー: Actions > Collect Economic Data > Run workflow]
    ↓
RSS取得（10ソース）+ Yahoo Finance 指標取得（10指標）
    ↓
LLMでニュース要約（日本語）+ 関連度スコア + リスクカテゴリ分類
    ↓
LLMで4カテゴリのリスクスコア算出（0-100）
（通貨・金融と地政学・供給網は、指標から求めた定量シグナルを30%の重みで合成）
    ↓
総合リスク指数の算出 + 今後30日の経済イベント抽出
    ↓
JSON保存 → git commit → Deploy to GitHub Pages を呼び出し（reusable workflow）
```

LLMのAPIキーが未設定のとき、要約とリスク評価は行わず、前回のリスクスコアを引き継ぐ。

### データの鮮度

`meta.json` には、2つの時刻を記録する。
- `lastCollectedAt`: 収集スクリプトを実行した時刻。毎回進む。
- `lastUpdated`: リスク評価を更新できた時刻。LLMのAPIキー未設定や評価の失敗で更新できなかった回は進まない。

ダッシュボードは、`lastUpdated` が3日より古いと、画面上部に琥珀色の警告「リスク評価が N 日間更新されていません」を表示する。
収集を実行しても、リスク評価を更新できなければこの警告は消えない。
個別の指標には、取得に失敗して前回値を引き継いだとき、または記録時刻が3日より古いときに、「更新停止」バッジが付く。
警告は静的データ（本番）だけが対象で、ローカルバックエンドには出ない。

`meta.json` の `lastRun` には、直近の収集の健全性を記録する。
- `sources`: RSSソースの総数と、取得に失敗したソース名。
- `summaries`: 今回要約を試みた記事数と、試行後も要約できなかった記事数。
- `assessment`: リスク評価の結果（`ok` / `failed` / `skipped`。APIキー未設定は `skipped`）。

ダッシュボードは、失敗ソースが1件以上、要約失敗が試行数の半分以上、または評価が `failed` のとき、琥珀色の警告を追加で表示する。
`lastRun` がない古い `meta.json` では何も出さない。

### ローカル（Docker）での収集

ローカルバックエンドでは、サーバー起動後に自動スケジューラが有効化される。

| タイミング | 方式 |
|---|---|
| 7:00 / 19:00（JST） | 自動（node-cron） |
| 任意 | 手動: `curl -X POST http://localhost:8901/api/admin/collect -H "X-Admin-Key: <ADMIN_SECRET の値>"` |

手動実行の API は次のとおり。どちらも `X-Admin-Key` ヘッダーに `ADMIN_SECRET` の値が必要で、ヘッダーが一致しなければ 401 を返す（`ADMIN_SECRET` が未設定のときは、ヘッダーに関係なく 503）。

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/admin/collect` | 収集を開始する。即座に 202 を返し、収集はバックグラウンドで続く。実行中なら 409 |
| GET | `/api/admin/status` | 直近の収集ログと記事数を返す。`lastCollection.status` は `running`、`success`、`partial`、`error` のいずれか |

> **注意**: Docker は、DBが空の初回起動時に開発用のサンプルデータを投入する（`NODE_ENV=production` では投入しない）。実データは、収集を実行した後に追加される。

---

## テストとCI

```bash
pnpm test                    # vitest（scripts / frontend / backend の *.test.ts）
pnpm run type-check:scripts  # scripts/ の型チェック
```

CI（`.github/workflows/ci.yml`）も `workflow_dispatch` だけで動く。
実行すると、「Backend & scripts (type-check & test)」ジョブで backend と scripts の型チェック（`pnpm run type-check:scripts`）および `pnpm test` を行い、frontend の型チェックとビルドも行う。

---

## コスト

**$0 / 月**

| リソース | 費用 |
|---|---|
| Groq API | 無料（14,400 req/日） |
| GitHub Actions | 無料枠 2,000分/月（手動実行のみ。実行した分だけ消費） |
| GitHub Pages | 無料 |
| Yahoo Finance（本番の指標） | 無料（APIキー不要） |
| FRED / Open Exchange Rates / CoinGecko（ローカルバックエンドのみ） | 無料（FRED と Open Exchange Rates は無料のキーが必要） |
| RSS | 無料 |
