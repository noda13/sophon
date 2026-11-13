# sophon

株（stock）、技術（tech）、社会課題（issue）、経済（econ）の情報収集を、1 つの web アプリ、1 つの collector、1 つの型定義にまとめたリポジトリ。
収集したデータは JSON として `data` ブランチに置き、web アプリは GitHub Pages から配信する。

公開サイトは https://noda13.github.io/sophon/ 。

## 構成

- `src/collector`：source ごとのデータ収集。`src/collector/sources` に stock、tech、issue、econ の実装があり、`core` が LLM 呼び出しや入出力を担う
- `src/web`：React と TanStack Router の web アプリ
- `src/shared`：collector と web が共有する型（zod スキーマ）。両者が同じスキーマで JSON を読み書きする
- `data` ブランチ：収集結果の JSON。コードとは別に、履歴を持たない単一コミットで管理する
- `scripts/build-site.mjs`：vite build の結果に `data` ブランチの JSON を重ね、Pages 用の `dist/` を作る

GitHub Pages のパスは `/sophon/` 。
別のパスで配信するときは、ビルド時に環境変数 `SITE_BASE` で指定する。
Pages の公開元は Settings > Pages で「GitHub Actions」にしておく。

## コマンド

Node 24 以上と pnpm が要る。

| コマンド | 内容 |
|---|---|
| `pnpm install` | 依存関係のインストール |
| `pnpm dev` | 開発サーバーの起動。リポジトリ直下の `data/` を `/sophon/data/` として返す |
| `pnpm build` | web アプリのビルド（`vite build`） |
| `pnpm type-check` | 型検査（`tsc -b`） |
| `pnpm test` | テストの実行（`vitest run`） |
| `pnpm collect <source...\|all>` | 収集の実行。source は stock、tech、issue、econ |
| `node scripts/build-site.mjs` | 配信物 `dist/` の組み立て。`data/` に `data` ブランチを checkout しておく |

収集結果の出力先は、環境変数 `SOPHON_DATA_DIR` で変えられる（既定は `data/`）。

## ワークフロー

`.github/workflows` には 3 つある。

- `ci.yml`：main への push と PR で、型検査、テスト、ビルドを実行する
- `collect.yml`：データの収集と公開
- `site.yml`：Pages への配信

`collect.yml` は cron で source ごとに起動する（UTC）。

| source | cron |
|---|---|
| stock | `17 8 * * 1-5`（平日） |
| tech | `17 21 * * *` |
| issue | `17 22 * * *` |
| econ | `17 0 * * *` |

手動で実行するときは workflow_dispatch の `source` 入力で `all`、`stock`、`tech`、`issue`、`econ` から選ぶ。
実行は source が違っても直列に流す。publish ジョブは実行開始時点の `data` を元にした全体で `data` ブランチを置き換えるため、並列にすると先に公開された更新が消える。
待機できる run は 1 つだけなので、手動で続けて dispatch するときは、前の run が終わってから起動する。2 つ続けると、待機中の run が取り消される。

流れは次のとおり。

1. collect ジョブが `pnpm collect` を実行し、結果を artifact に渡す。API キーを持つのはこのジョブだけで、書き込み権限は持たない
2. publish ジョブが `data` ブランチの内容を置き換え、孤立コミット（親を持たないコミット）を作って `data` ブランチへ force push する。書き込み権限を持つのはこのジョブだけ
3. データに変更があれば、`site.yml` を呼んで Pages へ配信する

`site.yml` は `src/web`、`src/shared` などの変更を main に push したときにも単独で動く。

失敗した source があっても、データの公開と配信は行う。
そのうえでワークフローを失敗にし、`collect-failure` ラベルの Issue を作る。
すでに開いている Issue があれば、新しい Issue は作らずコメントを追記する。

## secrets

Settings > Secrets and variables > Actions に登録する。

| secret | 用途 |
|---|---|
| `GEMINI_API_KEY` | Gemini の API キー |
| `GROQ_API_KEY` | Groq の API キー |
| `JQUANTS_API_KEY` | J-Quants の API キー（stock） |
| `RSSHUB_URL` | RSSHub の URL |
| `LLM_PROVIDER` | 任意。`groq` か `gemini` を指定する |

## LLM の既定

LLM は、キーが設定されているプロバイダを次の順に選ぶ。

1. Groq（`GROQ_API_KEY`）。モデルは `openai/gpt-oss-120b`
2. Gemini（`GEMINI_API_KEY`）。モデルは `gemini-flash-latest`
3. どちらのキーもなければ、LLM を使う処理を飛ばす

`LLM_PROVIDER` で指定したプロバイダのキーがあれば、その指定が優先される。
モデルは環境変数 `LLM_MODEL` で上書きできる。
