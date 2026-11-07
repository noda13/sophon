import { z } from 'zod';
import { DigestSchema, ImportanceSchema, TechCategorySchema, type Article } from '../../../shared/schema/tech';

export const SummaryResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int().min(0),
      summaryJa: z.string(),
      category: TechCategorySchema,
      importance: ImportanceSchema,
    }),
  ),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const DigestDraftSchema = DigestSchema.omit({ date: true, generatedAt: true });
export type DigestDraft = z.infer<typeof DigestDraftSchema>;

export const SUMMARY_SYSTEM = `あなたはITニュースのキュレーターです。与えられたニュース記事を分析し、各記事について次の項目を返してください。

- index: 入力の [n] の n
- summaryJa: 日本語で2-3文の簡潔な要約
- category: 記事の内容に最も合致するカテゴリ（提示されたhintを参考にしつつ、最終判断はあなたが行う）。選択肢: "trend", "ai", "security", "release"
  - trend: 開発・技術の最新動向、フレームワーク、プログラミング手法など
  - ai: AI・機械学習・LLMの動向、モデルリリース、研究成果など
  - security: 脆弱性、セキュリティインシデント、CVE、セキュリティアドバイザリなど
  - release: 製品・OSS・SaaSのリリース、バージョンアップ、新機能発表など
- importance: 記事の重要度。選択肢: "高", "中", "低"
  - 高: 業界全体に影響する重大なニュース（メジャーバージョンリリース、重大脆弱性、業界を変えるAIリリースなど）
  - 中: 注目すべきだが限定的な影響（マイナーリリース、技術動向記事、中程度の脆弱性など）
  - 低: ニッチまたは影響が小さいニュース`;

export function buildSummaryPrompt(batch: readonly Pick<Article, 'source' | 'category' | 'originalTitle'>[]): string {
  return batch.map((a, i) => `[${i}] source:${a.source} hint:${a.category} title:${a.originalTitle}`).join('\n');
}

export const DIGEST_MAX_HIGHLIGHTS = 5;

export const DIGEST_SYSTEM = `あなたはITニュースのキュレーターです。本日の重要なIT関連ニュースを日本語でダイジェスト形式にまとめてください。

- overviewJa: 1段落の概要
- sections: カテゴリ（trend, ai, security, release）のうち該当するものだけを含める
- 各セクションの highlights は最大${DIGEST_MAX_HIGHLIGHTS}件。title、summaryJa、url は入力の記事から取る`;

export function buildDigestPrompt(candidates: readonly Article[]): string {
  return candidates
    .map((a) => `[${a.category}][${a.importance}] ${a.source}: ${a.originalTitle}\nURL: ${a.originalUrl}\n要約: ${a.summaryJa}`)
    .join('\n\n');
}
