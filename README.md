# sophon

情報収集アプリ群の pnpm モノレポ。

| ディレクトリ | 旧リポジトリ | 内容 |
|---|---|---|
| apps/stock | waga-scope | 株 |
| apps/tech | techscope | 技術 |
| apps/issue | issue-radar | 社会課題 |
| apps/econ | econoguard | 経済 |

## 公開サイト

4 つの frontend を 1 つの GitHub Pages サイトとして配信する。

- 入口: https://noda13.github.io/sophon/
- 各アプリ: `/sophon/stock/`、`/sophon/tech/`、`/sophon/issue/`、`/sophon/econ/`

ローカルでの組み立て: `node scripts/build-site.mjs`（`site-dist/` に出力）。配信パスは既定で `/sophon/` で、`SITE_PATH=/ node scripts/build-site.mjs` ならルート配信用に作れる（`python3 -m http.server -d site-dist` で確認）。
`.github/workflows/site.yml` は main への push と、各 collect ワークフローがデータを更新した後に実行される。
Pages の公開元は Settings > Pages で「GitHub Actions」にしておく。
