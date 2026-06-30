# techscope

ITニュース・技術トレンドを自動収集・AI要約し、ダッシュボード＋日次ダイジェストとして提供するアプリです。

---

## 概要

techscope は、複数の RSS フィードから IT ニュース・技術情報を自動収集し、LLM（Groq / Gemini）で要約・分類して静的 JSON として管理します。React SPA のダッシュボードで閲覧でき、毎日自動更新されます。

---

## 特徴

- **$0 運用** — GitHub Actions（無料枠）+ Cloudflare Workers（無料枠）+ Gemini API（無料枠）で完全無料運用
- **4 カテゴリ対応** — 技術トレンド / AI・LLM / セキュリティ / リリース情報
- **EOL 監視** — ソフトウェア・ランタイムのサポート終了情報を追跡
- **日次ダイジェスト** — LLM による日本語要約を毎朝自動生成
- **静的アーキテクチャ** — Cloudflare Workers Assets でホスティング

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
LLM_PROVIDER=gemini

# Gemini API キー
GEMINI_API_KEY=your_gemini_api_key

# Groq API キー（代替）
GROQ_API_KEY=your_groq_api_key
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

## デプロイ（Cloudflare Workers）

### 初回セットアップ

1. **Cloudflare アカウントを準備し、wrangler でログイン**

   ```bash
   pnpm wrangler login
   ```

2. **GitHub Secrets を設定**

   リポジトリの Settings → Secrets and variables → Actions で以下を追加：

   | シークレット名           | 内容                                          |
   |--------------------------|-----------------------------------------------|
   | `GEMINI_API_KEY`         | Gemini の API キー                            |
   | `GROQ_API_KEY`           | Groq の API キー（任意）                      |
   | `LLM_PROVIDER`           | `gemini` または `groq`（任意、デフォルト: gemini） |
   | `CLOUDFLARE_API_TOKEN`   | Cloudflare API トークン（Workers 権限）       |
   | `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare アカウント ID                      |

3. **手動デプロイ（確認用）**

   ```bash
   cd frontend && pnpm build
   cd .. && pnpm wrangler deploy
   ```

### 自動運用フロー

GHA が以下の 2 段階で自動運用します：

1. **データ収集**（`collect.yml`）— 毎日 JST 06:00 に実行
   - RSS フィード取得 → LLM 要約 → `frontend/public/data/` にコミット

2. **デプロイ**（`deploy.yml`）— collect 完了後、または master push 時に実行
   - `frontend/` をビルド → Cloudflare Workers Assets にデプロイ

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
  (自動コミット → Cloudflare Workers デプロイ)
        |
        v
  Cloudflare Workers Assets
  (静的ホスティング)
        |
        v
  React SPA (Vite)
  (ダッシュボード / ダイジェスト表示)
```

---

## データソース一覧

### 技術トレンド
- Hacker News
- Zenn トレンド
- Qiita トレンド
- Publickey
- GitHub Blog (Engineering)
- Gigazine

### AI・LLM
- Anthropic Blog
- OpenAI News
- Google AI Blog
- Hugging Face Blog
- arXiv cs.AI

### セキュリティ
- JPCERT/CC
- CISA Advisories
- The Hacker News
- Bleeping Computer

### リリース情報
- Node.js Blog
- Kubernetes Blog
- AWS Blog
- Vite Releases
- Deno Releases

### EOL 監視
- endoflife.date API

---

## LLM プロバイダ設定

### Gemini（デフォルト・推奨）

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaxxxx
```

[Google AI Studio](https://aistudio.google.com) で API キーを取得してください。

### Groq（代替）

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_xxxx
```

[Groq Console](https://console.groq.com) で API キーを取得してください。

---

## econoguard との違い

| 項目              | techscope              | econoguard             |
|------------------|------------------------|------------------------|
| 対象ドメイン      | IT ニュース・技術      | 経済・金融指標         |
| リスクスコア      | なし                   | あり（投資判断向け）   |
| コレクター        | 静的コレクター一本     | 複数コレクター         |
| LLM 用途         | ニュース要約           | 経済分析・リスク評価   |
| EOL 監視         | あり                   | なし                   |

---

## ライセンス

MIT
