import { processInBatches, type BatchResult } from '../../core/batch';
import { generateStructured, type LlmConfig } from '../../core/llm';
import { IDEA_MIN_APPIFIABILITY, type Idea, type Issue } from '../../../shared/schema/issue';
import { buildIdeaPrompt, IDEA_SYSTEM, IdeaResponseSchema, type IdeaResponse } from './prompts';

export const IDEA_MAX_ITEMS = 20;
export const IDEA_INTERVAL_MS = 3_000;
const DIFFICULTIES = ['low', 'medium', 'high'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export function isIdeaTarget(issue: Issue): boolean {
  return issue.appifiabilityScore >= IDEA_MIN_APPIFIABILITY && !issue.ideaGeneratedAt;
}

export function normalizeDifficulty(raw: string): Difficulty {
  const key = raw.trim().toLowerCase();
  return (DIFFICULTIES as readonly string[]).includes(key) ? (key as Difficulty) : 'medium';
}

export function applyIdea(issue: Issue, r: IdeaResponse, now: Date): void {
  issue.proposedAppIdea = r.proposedAppIdea;
  issue.mvpFeatures = r.mvpFeatures;
  issue.targetUsers = r.targetUsers;
  issue.difficulty = normalizeDifficulty(r.difficulty);
  issue.ideaGeneratedAt = now.toISOString();
}

export function toIdeas(issues: readonly Issue[]): Idea[] {
  const ideas: Idea[] = [];
  for (const i of issues) {
    if (i.appifiabilityScore >= IDEA_MIN_APPIFIABILITY && i.proposedAppIdea && i.ideaGeneratedAt) {
      ideas.push({ ...i, ideaGeneratedAt: i.ideaGeneratedAt });
    }
  }
  return ideas;
}

export interface IdeaOptions {
  config: LlmConfig;
  now: Date;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  onError?: (message: string) => void;
}

// 1 件ずつ呼ぶ。バッチにまとめると 1 件の失敗で全件が失敗扱いになる。
export function generateIdeas(issues: Issue[], opts: IdeaOptions): Promise<BatchResult> {
  return processInBatches(
    issues.filter(isIdeaTarget),
    async ([issue]) => {
      if (!issue) return;
      const response = await generateStructured(IdeaResponseSchema, buildIdeaPrompt(issue), {
        system: IDEA_SYSTEM,
        config: opts.config,
        maxAttempts: opts.maxAttempts,
      });
      if (!response) throw new Error('LLM is not configured');
      applyIdea(issue, response, opts.now);
    },
    {
      batchSize: 1,
      intervalMs: IDEA_INTERVAL_MS,
      max: IDEA_MAX_ITEMS,
      sleep: opts.sleep,
      isDone: (i) => !!i.ideaGeneratedAt,
      attemptsKey: 'ideaAttempts',
      onBatchError: (e) => opts.onError?.(`idea generation: ${e instanceof Error ? e.message : String(e)}`),
    },
  );
}
