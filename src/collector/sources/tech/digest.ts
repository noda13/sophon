import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DIGEST_DATE_PATTERN, type Article, type Digest } from '../../../shared/schema/tech';
import { generateStructured, type LlmConfig } from '../../core/llm';
import {
  buildDigestPrompt,
  DIGEST_MAX_HIGHLIGHTS,
  DIGEST_MAX_OUTPUT_TOKENS,
  DIGEST_MAX_SECURITY_HIGHLIGHTS,
  DIGEST_SYSTEM,
  DigestDraftSchema,
  type DigestDraft,
} from './prompts';

export const DIGEST_MAX_CANDIDATES = 30;
// security の記事が少ない日は余りを他のカテゴリに回す。多い日でも他のカテゴリが全滅しないよう、枠は下限として働く。
export const DIGEST_SECURITY_RESERVED = 12;

const IMPORTANCE_RANK: Record<Article['importance'], number> = { 高: 0, 中: 1, 低: 2 };

export function rankByImportance(articles: readonly Article[]): Article[] {
  return [...articles].sort(
    (a, b) =>
      IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function selectDigestCandidates(articles: readonly Article[], limit = DIGEST_MAX_CANDIDATES): Article[] {
  const ranked = rankByImportance(articles.filter((a) => a.summaryJa.length > 0 && a.importance !== '低'));
  const reserved = ranked.filter((a) => a.category === 'security').slice(0, Math.min(DIGEST_SECURITY_RESERVED, limit));
  const reservedIds = new Set(reserved.map((a) => a.id));
  const rest = ranked.filter((a) => !reservedIds.has(a.id)).slice(0, limit - reserved.length);
  return rankByImportance([...reserved, ...rest]);
}

// security を先頭に寄せ、残りは入力の順を保つ。
const securityFirst = <T extends { category: string }>(sections: readonly T[]): T[] => [
  ...sections.filter((s) => s.category === 'security'),
  ...sections.filter((s) => s.category !== 'security'),
];

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

// セクションは LLM の順序に頼らず security を先頭にする。used による重複除外も security が先に取るため。
// LLM が返すのは候補の index だけで、url と title は候補から引く。index が範囲外のハイライトと、同じ記事の重複は捨てる。
// 候補の URL も RSS 由来なので、画面側の safeHref とは別に scheme をここでも検証する（多層防御）。
export function assembleDigest(draft: DigestDraft, candidates: readonly Article[], now: Date): Digest {
  const used = new Set<number>();
  const sections = securityFirst(draft.sections)
    .map((section) => ({
      category: section.category,
      highlights: section.highlights
        .flatMap(({ index }) => {
          const article = candidates[index];
          if (!article || used.has(index) || !isHttpUrl(article.originalUrl)) return [];
          used.add(index);
          return [{ title: article.originalTitle, summaryJa: article.summaryJa, url: article.originalUrl }];
        })
        .slice(0, section.category === 'security' ? DIGEST_MAX_SECURITY_HIGHLIGHTS : DIGEST_MAX_HIGHLIGHTS),
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
export async function buildDigest(
  articles: readonly Article[],
  now: Date,
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<Digest | null> {
  const candidates = selectDigestCandidates(articles);
  if (candidates.length === 0) return null;
  const draft = await generateStructured(DigestDraftSchema, buildDigestPrompt(candidates), {
    system: DIGEST_SYSTEM,
    config,
    maxOutputTokens: DIGEST_MAX_OUTPUT_TOKENS,
    signal,
  });
  if (!draft) throw new Error('LLM returned no digest');
  return assembleDigest(draft, candidates, now);
}

// 索引は digest/ の実ファイルから作り直す。差分更新にすると、手で消した日や取りこぼした日が索引に残る。
// extraDate は同じ実行で書き出す途中のダイジェストの日付で、まだディスクにない。
export function listDigestDates(dir: string, extraDate?: string): string[] {
  let names: string[] = [];
  try {
    names = readdirSync(join(dir, 'digest'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const dates = new Set(names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -'.json'.length)));
  if (extraDate) dates.add(extraDate);
  return [...dates].filter((d) => DIGEST_DATE_PATTERN.test(d)).sort().reverse();
}
