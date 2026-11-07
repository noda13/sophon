import { processInBatches, type BatchResult } from '../../core/batch';
import { generateStructured, type LlmConfig } from '../../core/llm';
import { ISSUE_CATEGORIES, type Issue, type IssueCategory } from '../../../shared/schema/issue';
import { buildClassifyPrompt, CLASSIFY_SYSTEM, ClassifyResponseSchema, type ClassifyResponse } from './prompts';

export const CLASSIFY_BATCH_SIZE = 10;
export const CLASSIFY_INTERVAL_MS = 30_000;
export const CLASSIFY_MAX_ITEMS = 50;
const FALLBACK_CATEGORY: IssueCategory = 'governance';

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeCategory(raw: string): IssueCategory {
  const key = raw.trim().toLowerCase();
  return (ISSUE_CATEGORIES as readonly string[]).includes(key) ? (key as IssueCategory) : FALLBACK_CATEGORY;
}

export function applyClassification(issue: Issue, r: ClassifyResponse['results'][number], now: Date): void {
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
}

export function classifyTargets(issues: readonly Issue[]): Issue[] {
  return issues.filter((i) => !i.classifiedAt);
}

// index は batch 内の位置。LLM が返さなかった・範囲外の項目は未分類のまま残り、試行回数が増える。
export function classifyIssues(issues: Issue[], opts: ClassifyOptions): Promise<BatchResult> {
  return processInBatches(
    classifyTargets(issues),
    async (batch) => {
      const response = await generateStructured(ClassifyResponseSchema, buildClassifyPrompt(batch), {
        system: CLASSIFY_SYSTEM,
        config: opts.config,
        maxAttempts: opts.maxAttempts,
      });
      if (!response) throw new Error('LLM is not configured');
      for (const r of response.results) {
        const issue = batch[r.index];
        if (issue) applyClassification(issue, r, opts.now);
      }
    },
    {
      batchSize: CLASSIFY_BATCH_SIZE,
      intervalMs: CLASSIFY_INTERVAL_MS,
      max: CLASSIFY_MAX_ITEMS,
      sleep: opts.sleep,
      isDone: (i) => i.classifiedAt !== null,
      attemptsKey: 'classifyAttempts',
      onBatchError: (e, index) =>
        opts.onError?.(`classify batch ${index + 1}: ${e instanceof Error ? e.message : String(e)}`),
    },
  );
}
