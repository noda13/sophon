import { LLM_BUDGET_MS } from './budget';
import { classifyIssues } from './classify';
import { buildFeeds, ISSUE_RETENTION, newIssue, seenIdsOf, type IssueFeed } from './feeds';
import { generateIdeas, toIdeas } from './ideas';
import { buildCategorySummary } from './summary';
import { jsonFile, readJson, writeJsonBatch } from '../../core/io';
import { detectProvider, LLM_DISABLED_ERROR } from '../../core/llm';
import { collectFeeds } from '../../core/rss';
import type { CollectorSource, RunContext, RunResult } from '../../core/source';
import {
  CategorySummaryFileSchema,
  IdeasFileSchema,
  IssuesFileSchema,
} from '../../../shared/schema/issue';

export interface IssueSourceDeps {
  sleep?: (ms: number) => Promise<void>;
  llmMaxAttempts?: number;
  llmBudgetMs?: number;
  clock?: () => number;
}

export function createSource(deps: IssueSourceDeps = {}): CollectorSource {
  return {
    id: 'issue',
    async run(ctx: RunContext): Promise<RunResult> {
      const errors: string[] = [];
      const feeds = buildFeeds(ctx.env);
      const previous = readJson(ctx.dir, 'issues.json', IssuesFileSchema, []);
      const previousIds = new Set(previous.map((i) => i.id));

      const failedSources: string[] = [];
      const failures: { source: string; reason: string }[] = [];
      const issues = await collectFeeds<IssueFeed, ReturnType<typeof newIssue>>({
        sources: feeds,
        existing: previous,
        seenIds: seenIdsOf(previous),
        limit: ISSUE_RETENTION,
        failedSources,
        failures,
        signal: ctx.signal,
        toRecord: (item, feed) => newIssue(item, feed, ctx.now),
      });
      for (const { source, reason } of failures) errors.push(`RSS failed: ${source} (${reason})`);

      const counts: Record<string, number> = {
        issues: issues.length,
        newIssues: issues.filter((i) => !previousIds.has(i.id)).length,
        failedSources: failedSources.length,
        classified: 0,
        classifyFailed: 0,
        ideasGenerated: 0,
        ideaFailed: 0,
        llmSkipped: 0,
        llmDeferred: 0,
      };

      // 分類や idea 生成の途中で timeout しても、そこまでの結果を失わないよう各段階で書き出す。
      const persist = () => {
        writeJsonBatch(ctx.dir, {
          'issues.json': jsonFile(IssuesFileSchema, issues),
          'ideas.json': jsonFile(IdeasFileSchema, toIdeas(issues)),
          'category-summary.json': jsonFile(CategorySummaryFileSchema, buildCategorySummary(issues)),
        });
      };

      // generateStructured は process.env を読むので、ctx.env から解決した設定を渡す。
      const config = detectProvider(ctx.env);
      if (config) {
        const clock = deps.clock ?? Date.now;
        const common = {
          config,
          now: ctx.now,
          sleep: deps.sleep,
          maxAttempts: deps.llmMaxAttempts,
          signal: ctx.signal,
          budget: { deadline: clock() + (deps.llmBudgetMs ?? LLM_BUDGET_MS), clock },
          onError: (message: string) => errors.push(message),
          onProgress: persist,
        };
        const classify = await classifyIssues(issues, common);
        counts.classified = classify.attempted - classify.failed;
        counts.classifyFailed = classify.failed;
        persist();
        const ideaRun = await generateIdeas(issues, common);
        counts.ideasGenerated = ideaRun.attempted - ideaRun.failed;
        counts.ideaFailed = ideaRun.failed;
        counts.llmDeferred = classify.deferred + ideaRun.deferred;
        if (counts.llmDeferred > 0) errors.push(`LLM budget exceeded: ${counts.llmDeferred} items deferred to next run`);
      } else {
        counts.llmSkipped = 1;
        errors.push(LLM_DISABLED_ERROR);
        console.log('  No LLM API key, skipping classification and idea generation');
      }

      counts.ideas = toIdeas(issues).length;
      persist();

      return { counts, errors, forceFailed: !config };
    },
  };
}

export const source: CollectorSource = createSource();
