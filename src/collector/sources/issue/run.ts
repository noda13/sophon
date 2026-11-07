import { classifyIssues } from './classify';
import { buildFeeds, ISSUE_RETENTION, newIssue, seenIdsOf, type IssueFeed } from './feeds';
import { generateIdeas, toIdeas } from './ideas';
import { buildCategorySummary } from './summary';
import { jsonFile, readJson, writeJsonBatch } from '../../core/io';
import { detectProvider } from '../../core/llm';
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
      const issues = await collectFeeds<IssueFeed, ReturnType<typeof newIssue>>({
        sources: feeds,
        existing: previous,
        seenIds: seenIdsOf(previous),
        limit: ISSUE_RETENTION,
        failedSources,
        toRecord: (item, feed) => newIssue(item, feed, ctx.now),
      });
      for (const source of failedSources) errors.push(`feed failed: ${source}`);

      const counts: Record<string, number> = {
        issues: issues.length,
        newIssues: issues.filter((i) => !previousIds.has(i.id)).length,
        failedSources: failedSources.length,
        classified: 0,
        classifyFailed: 0,
        ideasGenerated: 0,
        ideaFailed: 0,
        llmSkipped: 0,
      };

      // generateStructured は process.env を読むので、ctx.env から解決した設定を渡す。
      const config = detectProvider(ctx.env);
      if (config) {
        const common = { config, now: ctx.now, sleep: deps.sleep, maxAttempts: deps.llmMaxAttempts };
        const onError = (message: string) => errors.push(message);
        const classify = await classifyIssues(issues, { ...common, onError });
        counts.classified = classify.attempted - classify.failed;
        counts.classifyFailed = classify.failed;
        const ideaRun = await generateIdeas(issues, { ...common, onError });
        counts.ideasGenerated = ideaRun.attempted - ideaRun.failed;
        counts.ideaFailed = ideaRun.failed;
      } else {
        counts.llmSkipped = 1;
        console.log('  No LLM API key, skipping classification and idea generation');
      }

      const ideas = toIdeas(issues);
      counts.ideas = ideas.length;

      writeJsonBatch(ctx.dir, {
        'issues.json': jsonFile(IssuesFileSchema, issues),
        'ideas.json': jsonFile(IdeasFileSchema, ideas),
        'category-summary.json': jsonFile(CategorySummaryFileSchema, buildCategorySummary(issues)),
      });

      return { counts, errors };
    },
  };
}

export const source: CollectorSource = createSource();
