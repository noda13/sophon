import { z } from 'zod';
import { RiskCategorySchema, type NewsArticle } from '../../../shared/schema/econ';
import { DEFAULT_INTERVAL_MS, MAX_SUMMARY_ATTEMPTS, processInBatches } from '../../core/batch';
import { generateStructured, type LlmConfig } from '../../core/llm';
import { MAX_NEWS } from './feeds';

const BATCH_SIZE = 10;
const MAX_PER_RUN = 50;
const MAX_SEEN_IDS = 2000;
export const MIN_RELEVANCE = 30;

const SYSTEM = `あなたはグローバル経済リスクアナリストです。与えられたニュース記事を分析し、各記事を評価してください。

各記事について（index は入力の [番号]）:
- summaryJa: 日本語で2-3文の簡潔な要約（マクロ経済・金融市場への影響を中心に）
- relevanceScore: グローバル経済リスクとの関連度（0-100の整数）。以下の基準で厳格に評価:
  - 70-100: マクロ経済に直接影響（金融政策変更、通貨危機、貿易摩擦、地政学的衝突、主要指標の大幅変動）
  - 40-69: 間接的だが無視できない影響（業界全体の規制変更、主要企業の業績が市場に波及）
  - 10-29: 影響が限定的またはローカル（個別企業人事、地方ニュース、小規模イベント）
  - 0-9: 経済リスクと無関係
- riskCategories: 関連するカテゴリの配列。選択肢: "currency_finance", "geopolitics_supply_chain", "technology", "social_policy"
  relevanceScoreが30未満の記事は空配列[]にしてください。`;

// The model is only asked for this loose shape. Each entry is then validated on its own so one bad
// entry is dropped instead of discarding the other nine summaries in the batch.
const ResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      summaryJa: z.string(),
      relevanceScore: z.number(),
      riskCategories: z.array(z.string()),
    }),
  ),
});

const ResultEntrySchema = z.object({
  index: z.number().int().min(0),
  summaryJa: z.string().trim().min(1),
  relevanceScore: z.number().int().min(0).max(100),
  riskCategories: z.array(RiskCategorySchema),
});

export interface SummarizeResult {
  attempted: number;
  failed: number;
}

export interface SummarizeOptions {
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
}

export async function summarize(
  articles: NewsArticle[],
  config: LlmConfig,
  opts: SummarizeOptions = {},
): Promise<SummarizeResult> {
  const attemptsBefore = new Map(articles.map((a) => [a, a.summaryAttempts]));
  let batchErrors = 0;

  const { attempted, failed, batches } = await processInBatches(
    articles,
    async (batch) => {
      const prompt = batch.map((a, j) => `[${j}] ${a.source}: ${a.originalTitle}`).join('\n');
      const response = await generateStructured(ResponseSchema, prompt, { system: SYSTEM, config });
      if (!response) throw new Error('LLM is not configured');

      let accepted = 0;
      for (const entry of response.results) {
        const res = ResultEntrySchema.safeParse(entry);
        if (!res.success) {
          console.warn('[summarize] Dropping invalid result entry:', res.error.issues);
          continue;
        }
        const target = batch[res.data.index];
        if (!target) continue;
        target.summaryJa = res.data.summaryJa;
        target.relevanceScore = res.data.relevanceScore;
        target.riskCategories = res.data.riskCategories;
        accepted++;
      }
      console.log(`  ${accepted}/${batch.length} summarized`);
    },
    {
      batchSize: BATCH_SIZE,
      max: MAX_PER_RUN,
      intervalMs: opts.intervalMs ?? DEFAULT_INTERVAL_MS,
      sleep: opts.sleep,
      isDone: (a) => a.summaryJa !== '',
      attemptsKey: 'summaryAttempts',
      maxAttempts: MAX_SUMMARY_ATTEMPTS,
      onBatchError: (error) => {
        batchErrors++;
        console.error('  Summarize failed:', error instanceof Error ? error.message : error);
      },
    },
  );

  // Every call failing means the provider was down or out of quota, not that the articles are
  // unsummarizable; charging them an attempt would exhaust a backlog after a few bad runs.
  if (batches > 0 && batchErrors === batches) {
    for (const [article, attempts] of attemptsBefore) {
      if (attempts === undefined) delete article.summaryAttempts;
      else article.summaryAttempts = attempts;
    }
  }

  return { attempted, failed };
}

function isSummaryExhausted(a: NewsArticle): boolean {
  return !a.summaryJa && (a.summaryAttempts ?? 0) >= MAX_SUMMARY_ATTEMPTS;
}

// Unsummarized articles are kept so they are not dropped before the next LLM run can score them,
// until their retries are exhausted.
export function selectPublishedNews(news: readonly NewsArticle[]): NewsArticle[] {
  return news
    .filter((a) => (a.summaryJa ? a.relevanceScore >= MIN_RELEVANCE : !isSummaryExhausted(a)))
    .slice(0, MAX_NEWS);
}

// Low-relevance articles leave news.json but still reappear in the RSS feeds; remembering their ids
// keeps them from consuming the per-run summarize budget again.
export function nextSeenIds(prevSeen: readonly string[], news: readonly NewsArticle[]): string[] {
  const dropped = news
    .filter((a) => (a.summaryJa && a.relevanceScore < MIN_RELEVANCE) || isSummaryExhausted(a))
    .map((a) => a.id);
  return [...new Set([...prevSeen, ...dropped])].slice(-MAX_SEEN_IDS);
}
