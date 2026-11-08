import { z } from 'zod';
import type { Issue } from '../../../shared/schema/issue';

// category と difficulty は z.string() で受けて normalize する。enum にすると 1 件の揺れでバッチ全体が捨てられる。
export const ClassifyResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      summaryJa: z.string(),
      category: z.string(),
      severityScore: z.number(),
      urgencyScore: z.number(),
      appifiabilityScore: z.number(),
      affectedDomain: z.array(z.string()),
    }),
  ),
});
export type ClassifyResponse = z.infer<typeof ClassifyResponseSchema>;

// モデルには上の緩い形だけを要求し、1 件ずつこの schema で検証して不正な項目だけ捨てる。
// バッチ全体を落とすと同じ入力を再試行しても同じ揺れで失敗し続ける。
export const ClassifyEntrySchema = z.object({
  index: z.number().int().min(0),
  summaryJa: z.string().trim().min(1),
  category: z.string(),
  severityScore: z.number().finite(),
  urgencyScore: z.number().finite(),
  appifiabilityScore: z.number().finite(),
  affectedDomain: z.array(z.string()),
});
export type ClassifyEntry = z.infer<typeof ClassifyEntrySchema>;

export const IdeaResponseSchema = z.object({
  proposedAppIdea: z.string(),
  mvpFeatures: z.array(z.string()),
  targetUsers: z.string(),
  difficulty: z.string(),
});
export type IdeaResponse = z.infer<typeof IdeaResponseSchema>;

export const CLASSIFY_SYSTEM = `あなたは社会課題アナリストです。与えられたニュース記事・投稿を社会課題として分析し、JSON形式で応答してください。

各記事について:
- index: 入力で与えられた index をそのまま返す
- summaryJa: 日本語で2-3文。課題の本質（誰が何に困っているか）を明確に
- category: 以下から1つ選択: employment_economy, healthcare_welfare, education, childcare_family, aging_care, governance, environment_disaster, community_regional
- severityScore: 課題の深刻度・影響範囲 (0-100)
- urgencyScore: 対処の緊急性 (0-100)
- appifiabilityScore: アプリ/ソフトウェアで解決・支援できる可能性 (0-100)
  80-100: 情報提供・マッチング・自動化でほぼ解決可能
  50-79: アプリで部分的に支援可能
  0-49: 制度変更・物理介入が主でアプリ効果は限定的
- affectedDomain: 影響領域キーワード配列（例: ["高齢者","介護","家族"]）

応答形式: {"results":[{"index":0,"summaryJa":"...","category":"...","severityScore":70,"urgencyScore":60,"appifiabilityScore":50,"affectedDomain":["..."]}]}`;

export const IDEA_SYSTEM = `あなたは社会課題を解決するアプリを考えるプロダクトデザイナーです。与えられた社会課題に対して、アプリ/ソフトウェアで解決するアイデアをJSON形式で提案してください。

応答形式:
{"proposedAppIdea":"概要1-2文","mvpFeatures":["機能1","機能2","機能3"],"targetUsers":"ターゲット像","difficulty":"low|medium|high"}

difficulty: low=6ヶ月以内MVP可能, medium=1年程度, high=2年以上`;

const CONTENT_LIMIT = 500;

export function buildClassifyPrompt(batch: readonly Pick<Issue, 'originalTitle' | 'rawContent'>[]): string {
  return JSON.stringify(
    batch.map((item, index) => ({
      index,
      title: item.originalTitle,
      content: item.rawContent.slice(0, CONTENT_LIMIT),
    })),
  );
}

export function buildIdeaPrompt(issue: Issue): string {
  return JSON.stringify({
    title: issue.originalTitle,
    summary: issue.summaryJa,
    category: issue.category,
    appifiabilityScore: issue.appifiabilityScore,
    affectedDomain: issue.affectedDomain,
  });
}
