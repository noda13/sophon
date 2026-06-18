# techscope

ITニュース・技術トレンドを自動収集・AI要約し、ダッシュボード＋日次ダイジェストとして提供するアプリです。

---

## 概要

techscope は、複数の RSS フィードから IT ニュース・技術情報を自動収集し、LLM（Groq / Gemini）で要約・分類して静的 JSON として GitHub Pages に公開します。React SPA のダッシュボードで閲覧でき、毎日自動更新されます。

---

## 特徴

- **$0 運用** — GitHub Actions（無料枠）+ GitHub Pages（無料）+ Groq API（無料枠）で完全無料運用
- **4 カテゴリ対応** — 技術トレンド / AI・LLM / セキュリティ / リリース情報
- **EOL 監視** — ソフトウェア・ランタイムのサポート終了情報を追跡
- **日次ダイジェスト** — LLM による日本語要約を毎朝自動生成
- **静的アーキテクチャ** — サーバー不要、GitHub Pages のみで動作

---

## セットアップ

### 前提条件

- Node.js 22 以上
- pnpm 10 以上

```bash
# pnpm がない場合
npm install -g pnpm@10
```

### インストール

```bash
git clone https://github.com/<your-username>/techscope.git
cd techscope
pnpm install
```

### 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して API キーを設定します：

```env
# LLM プロバイダ（groq / gemini）
LLM_PROVIDER=groq

# Groq API キー（無料枠あり）
GROQ_API_KEY=your_groq_api_key

# Gemini API キー（Groq の代替）
GEMINI_API_KEY=your_gemini_api_key
```

### ローカルでデータ収集

```bash
pnpm collect
```

収集されたデータは `frontend/public/data/` に JSON として保存されます。

### フロントエンド起動

```bash
cd frontend
pnpm dev
```

ブラウザで http://localhost:5173 を開きます。

---

## デプロイ（GitHub Pages）

1. **GitHub リポジトリを作成**（Private 推奨）

   ```bash
   gh repo create techscope --private
   git remote add origin https://github.com/<your-username>/techscope.git
   git push -u origin main
   ```

2. **GitHub Secrets を設定**

   リポジトリの Settings → Secrets and variables → Actions で以下を追加：

   | シークレット名  | 内容                              |
   |----------------|-----------------------------------|
   | `GROQ_API_KEY` | Groq の API キー（または Gemini） |
   | `GEMINI_API_KEY` | Gemini の API キー（任意）      |
   | `LLM_PROVIDER` | `groq` または `gemini`（任意、デフォルト: groq） |

3. **GitHub Pages を有効化**

   Settings → Pages → Source を **GitHub Actions** に設定

4. **初回データ収集**

   Actions タブ → `Collect IT Data` → `Run workflow` で手動実行してデータを初期化

5. **以後は自動運用**

   - 毎日 JST 06:00 にデータ収集（`collect.yml`）
   - 毎日 JST 06:30 に GitHub Pages へデプロイ（`deploy.yml`）

---

## アーキテクチャ

```
RSS Feeds (各種 IT メディア)
        |
        v
  scripts/collect.ts
  (Node.js + tsx)
        |
        v
  frontend/public/data/
  (JSON ファイル群)
        |
        v
  GitHub Actions
  (自動コミット → Pages デプロイ)
        |
        v
  GitHub Pages
  (静的ホスティング)
        |
        v
  React SPA (Vite)
  (ダッシュボード / ダイジェスト表示)
```

---

## データソース一覧

### 技術トレンド
- Hacker News (hn.algolia.com)
- Dev.to
- Zenn トレンド
- Qiita トレンド

### AI・LLM
- The Batch (DeepLearning.AI)
- Hugging Face Blog
- OpenAI Blog

### セキュリティ
- Krebs on Security
- The Hacker News
- JPCERT/CC

### リリース情報
- GitHub Blog
- Node.js ブログ
- Docker Blog

### EOL 監視
- endoflife.date API

---

## LLM プロバイダ設定

### Groq（デフォルト・推奨）

無料枠が大きく、レスポンスが高速です。

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_xxxx
```

[Groq Console](https://console.groq.com) で API キーを取得してください。

### Gemini

Google の Gemini API を使用します。

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaxxxx
```

[Google AI Studio](https://aistudio.google.com) で API キーを取得してください。

### その他 OpenAI 互換 API

環境変数でエンドポイントを上書きできます（`collect.ts` の設定を参照）。

---

## econoguard との違い

| 項目              | techscope          | econoguard             |
|------------------|--------------------|------------------------|
| 対象ドメイン      | IT ニュース・技術  | 経済・金融指標         |
| リスクスコア      | なし               | あり（投資判断向け）   |
| コレクター        | 静的コレクター一本 | 複数コレクター         |
| LLM 用途         | ニュース要約       | 経済分析・リスク評価   |
| EOL 監視         | あり               | なし                   |

---

## ライセンス

MIT
