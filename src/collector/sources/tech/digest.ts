import type { Article, Digest } from '../../../shared/schema/tech';
import { generateStructured, type LlmConfig } from '../../core/llm';
import {
  buildDigestPrompt,
  DIGEST_MAX_HIGHLIGHTS,
  DIGEST_SYSTEM,
  DigestDraftSchema,
  type DigestDraft,
} from './prompts';

export const DIGEST_MAX_CANDIDATES = 30;

const IMPORTANCE_RANK: Record<Article['importance'], number> = { 高: 0, 中: 1, 低: 2 };

export function rankByImportance(articles: readonly Article[]): Article[] {
  return [...articles].sort(
    (a, b) =>
      IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function selectDigestCandidates(articles: readonly Article[], limit = DIGEST_MAX_CANDIDATES): Article[] {
  return rankByImportance(articles.filter((a) => a.summaryJa.length > 0 && a.importance !== '低')).slice(0, limit);
}

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

// URL の scheme 検証は画面側の safeHref とは別に、ここでも落としておく（多層防御）。
export function assembleDigest(draft: DigestDraft, now: Date): Digest {
  const sections = draft.sections
    .map((section) => ({
      category: section.category,
      highlights: section.highlights.filter((h) => isHttpUrl(h.url)).slice(0, DIGEST_MAX_HIGHLIGHTS),
    }))
    .filter((section) => section.highlights.length > 0);
  return {
    date: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    overviewJa: draft.overviewJa,
    sections,
  };
}

/** 要約済みの記事がなければ null。LLM の失敗は throw する。 */
export async function buildDigest(articles: readonly Article[], now: Date, config: LlmConfig): Promise<Digest | null> {
  const candidates = selectDigestCandidates(articles);
  if (candidates.length === 0) return null;
  const draft = await generateStructured(DigestDraftSchema, buildDigestPrompt(candidates), {
    system: DIGEST_SYSTEM,
    config,
  });
  if (!draft) throw new Error('LLM returned no digest');
  return assembleDigest(draft, now);
}
