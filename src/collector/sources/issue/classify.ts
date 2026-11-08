import { generateStructured, type LlmConfig } from '../../core/llm';
import { ISSUE_CATEGORIES, type Issue, type IssueCategory } from '../../../shared/schema/issue';
import { processInBatchesWithin, type BudgetedBatchResult, type LlmBudget } from './budget';
import {
  buildClassifyPrompt,
  CLASSIFY_SYSTEM,
  ClassifyEntrySchema,
  ClassifyResponseSchema,
  type ClassifyEntry,
} from './prompts';

export const CLASSIFY_BATCH_SIZE = 10;
export const CLASSIFY_INTERVAL_MS = 30_000;
export const CLASSIFY_MAX_ITEMS = 50;
// 10 件の要約（2-3 文）と数値で 2k 前後。thinking 付きモデルでも途中で切れない余裕を持たせる。
export const CLASSIFY_MAX_OUTPUT_TOKENS = 8192;
const FALLBACK_CATEGORY: IssueCategory = 'governance';

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeCategory(raw: string): IssueCategory {
  const key = raw.trim().toLowerCase();
  return (ISSUE_CATEGORIES as readonly string[]).includes(key) ? (key as IssueCategory) : FALLBACK_CATEGORY;
}

export function applyClassification(issue: Issue, r: ClassifyEntry, now: Date): void {
  issue.summaryJa = r.summaryJa;
  issue.category = normalizeCategory(r.category);
  issue.severityScore = clampScore(r.severityScore);
  issue.urgencyScore = clampScore(r.urgencyScore);
  issue.appifiabilityScore = clampScore(r.appifiabilityScore);
  issue.affectedDomain = r.affectedDomain;
  issue.classifiedAt = now.toISOString();
}

export interface ClassifyOptions {
  config: LlmConfig;
  now: Date;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  onError?: (message: string) => void;
  signal?: AbortSignal;
  budget?: LlmBudget;
  /** バッチの結果を反映するたびに呼ぶ。途中で打ち切られても分類済みの分を保存できるようにする。 */
  onProgress?: () => void;
}

export function classifyTargets(issues: readonly Issue[]): Issue[] {
  return issues.filter((i) => !i.classifiedAt);
}

// index は batch 内の位置。LLM が返さなかった・範囲外の項目は未分類のまま残り、試行回数が増える。
export function classifyIssues(issues: Issue[], opts: ClassifyOptions): Promise<BudgetedBatchResult> {
  return processInBatchesWithin(
    classifyTargets(issues),
    async (batch) => {
      const response = await generateStructured(ClassifyResponseSchema, buildClassifyPrompt(batch), {
        system: CLASSIFY_SYSTEM,
        config: opts.config,
        maxAttempts: opts.maxAttempts,
        maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
        signal: opts.signal,
      });
      if (!response) throw new Error('LLM is not configured');
      for (const entry of response.results) {
        const parsed = ClassifyEntrySchema.safeParse(entry);
        if (!parsed.success) {
          console.warn('[classify] Dropping invalid result entry:', parsed.error.issues);
          continue;
        }
        const issue = batch[parsed.data.index];
        if (issue) applyClassification(issue, parsed.data, opts.now);
      }
      opts.onProgress?.();
    },
    {
      batchSize: CLASSIFY_BATCH_SIZE,
      intervalMs: CLASSIFY_INTERVAL_MS,
      max: CLASSIFY_MAX_ITEMS,
      sleep: opts.sleep,
      signal: opts.signal,
      budget: opts.budget,
      isDone: (i) => i.classifiedAt !== null,
      attemptsKey: 'classifyAttempts',
      onBatchError: (e, index) =>
        opts.onError?.(`classify batch ${index + 1}: ${e instanceof Error ? e.message : String(e)}`),
    },
  );
}
