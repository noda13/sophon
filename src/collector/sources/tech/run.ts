import { ArticlesFileSchema, DigestIndexSchema, DigestSchema, EolFileSchema, type Article } from '../../../shared/schema/tech';
import { processInBatches, DEFAULT_INTERVAL_MS, DEFAULT_MAX_ITEMS, MAX_SUMMARY_ATTEMPTS } from '../../core/batch';
import { jsonFile, readJson, writeJson, writeJsonBatch, type JsonFile } from '../../core/io';
import { detectProvider, generateStructured, LLM_DISABLED_ERROR } from '../../core/llm';
import { collectFeeds, type FetchFeedOptions } from '../../core/rss';
import type { CollectorSource, RunContext, RunResult } from '../../core/source';
import { applySummaries, capFreshPerFeed, MAX_ARTICLES, retainArticles, toArticle } from './articles';
import { buildDigest, listDigestDates } from './digest';
import { collectEol, EOL_PRODUCTS, type CollectEolOptions, type EolProduct } from './eol';
import { TECH_FEEDS, type TechFeed } from './feeds';
import { buildSummaryPrompt, SUMMARY_MAX_OUTPUT_TOKENS, SUMMARY_SYSTEM, SummaryResponseSchema, validateSummaries } from './prompts';

export interface TechRunOptions {
  feeds?: readonly TechFeed[];
  eolProducts?: readonly EolProduct[];
  fetchOptions?: FetchFeedOptions;
  eolOptions?: Omit<CollectEolOptions, 'signal'>;
  batchIntervalMs?: number;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runTech(ctx: RunContext, opts: TechRunOptions = {}): Promise<RunResult> {
  const { dir, now, signal } = ctx;
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  const prevArticles = readJson(dir, 'articles.json', ArticlesFileSchema, []);
  const prevEol = readJson(dir, 'eol.json', EolFileSchema, []);
  const prevIds = new Set(prevArticles.map((a) => a.id));

  console.log('--- Articles ---');
  const failedSources: string[] = [];
  const failures: { source: string; reason: string }[] = [];
  const feeds = opts.feeds ?? TECH_FEEDS;
  const merged = await collectFeeds<TechFeed, Article>({
    sources: feeds,
    existing: prevArticles,
    toRecord: toArticle,
    limit: Infinity,
    failedSources,
    failures,
    fetchOptions: opts.fetchOptions,
    signal,
  });
  const fresh = capFreshPerFeed(merged.filter((a) => !prevIds.has(a.id)));
  const freshIds = new Set(fresh.map((a) => a.id));
  const articles = retainArticles([...fresh, ...merged.filter((a) => prevIds.has(a.id))], freshIds, {
    unsummarizedSlots: DEFAULT_MAX_ITEMS,
    maxAttempts: MAX_SUMMARY_ATTEMPTS,
  }).slice(0, MAX_ARTICLES);
  for (const { source, reason } of failures) errors.push(`RSS failed: ${source} (${reason})`);
  counts.articles = articles.length;
  counts.newArticles = articles.filter((a) => freshIds.has(a.id)).length;
  counts.failedSources = failedSources.length;

  console.log('--- EOL ---');
  const eol = await collectEol(prevEol, now, opts.eolProducts ?? EOL_PRODUCTS, { ...opts.eolOptions, signal });
  for (const product of eol.failedProducts) errors.push(`EOL failed: ${product} (${eol.failureReasons[product]})`);
  counts.eol = eol.items.length;
  counts.failedEolProducts = eol.failedProducts.length;

  const files: Record<string, JsonFile> = { 'eol.json': jsonFile(EolFileSchema, eol.items) };
  const llm = detectProvider(ctx.env);
  counts.llmSkipped = llm ? 0 : 1;
  counts.summarized = 0;
  counts.summaryFailed = 0;
  counts.digest = 0;

  if (llm) {
    console.log(`--- LLM (${llm.provider}): Summarize & Classify ---`);
    const batch = await processInBatches(
      articles,
      async (items) => {
        const response = await generateStructured(SummaryResponseSchema, buildSummaryPrompt(items), {
          system: SUMMARY_SYSTEM,
          config: llm,
          maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
          signal,
        });
        if (!response) throw new Error('LLM returned no result');
        const { accepted, dropped } = validateSummaries(response);
        applySummaries(items, accepted);
        if (dropped > 0) errors.push(`summarize: dropped ${dropped} invalid entries`);
        // articles.json だけを先に書く。LLM が途中でタイムアウトしても、ここまでの要約を失わないため。
        // digest と eol.json は最後にまとめて書くので、中断した実行では articles.json だけが新しくなりうる。
        // 3 ファイルは独立して読まれ、要約は次回の実行にも引き継がれるので、この新旧の混在は許容している。
        writeJson(dir, 'articles.json', ArticlesFileSchema, articles);
      },
      {
        attemptsKey: 'summaryAttempts',
        isDone: (a) => a.summaryJa.length > 0,
        intervalMs: opts.batchIntervalMs ?? DEFAULT_INTERVAL_MS,
        signal,
        onBatchError: (e, i) => errors.push(`summarize batch ${i + 1} failed: ${errorMessage(e)}`),
      },
    );
    counts.summarized = batch.attempted - batch.failed;
    counts.summaryFailed = batch.failed;

    console.log(`--- LLM (${llm.provider}): Build Digest ---`);
    try {
      const digest = await buildDigest(articles, now, llm, signal);
      if (digest) {
        files['digest-latest.json'] = jsonFile(DigestSchema, digest);
        files[`digest/${digest.date}.json`] = jsonFile(DigestSchema, digest);
        files['digest/index.json'] = jsonFile(DigestIndexSchema, { dates: listDigestDates(dir, digest.date) });
        counts.digest = 1;
      } else {
        console.log('  No summarized articles for digest, skipping');
      }
    } catch (e) {
      errors.push(`digest failed: ${errorMessage(e)}`);
    }
  } else {
    console.log('No LLM configured, skipping AI processing');
    errors.push(LLM_DISABLED_ERROR);
  }

  files['articles.json'] = jsonFile(ArticlesFileSchema, articles);
  writeJsonBatch(dir, files);
  return { counts, errors, forceFailed: !llm };
}

export const source: CollectorSource = {
  id: 'tech',
  run: (ctx) => runTech(ctx),
};
