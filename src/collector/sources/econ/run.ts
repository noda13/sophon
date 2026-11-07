import { z } from 'zod';
import {
  CompositeRiskSchema,
  EventsFileSchema,
  IndicatorsFileSchema,
  NewsFileSchema,
  RiskHistoryFileSchema,
  RisksFileSchema,
  type RiskAssessment,
} from '../../../shared/schema/econ';
import { jsonFile, readJson, writeJsonBatch, type JsonFile } from '../../core/io';
import { detectProvider } from '../../core/llm';
import { collectFeeds } from '../../core/rss';
import type { CollectorSource, RunContext, RunResult } from '../../core/source';
import { assess, mergeRisks } from './assess';
import { computeComposite } from './composite';
import { checkEventCoverage, selectUpcomingEvents } from './events';
import { ECON_FEEDS, MAX_NEWS, toNewsArticle } from './feeds';
import { collectIndicators, unavailableIndicators } from './indicators';
import { updateRiskHistory } from './risk-history';
import { nextSeenIds, selectPublishedNews, summarize, type SummarizeResult } from './summarize';

const SeenIdsSchema = z.array(z.string());
const CompositeFileSchema = CompositeRiskSchema.nullable();

async function run(ctx: RunContext): Promise<RunResult> {
  const { dir, now, env } = ctx;
  const errors: string[] = [];

  const coverageWarning = checkEventCoverage(now);
  if (coverageWarning) {
    console.warn(`[events] ${coverageWarning}`);
    errors.push(coverageWarning);
  }

  const prevNews = readJson(dir, 'news.json', NewsFileSchema, []);
  const seenIds = readJson(dir, 'seen-ids.json', SeenIdsSchema, []);
  const prevIndicators = readJson(dir, 'indicators.json', IndicatorsFileSchema, []);
  const prevRisks = readJson(dir, 'risks.json', RisksFileSchema, []);
  const riskHistory = readJson(dir, 'risk-history.json', RiskHistoryFileSchema, {});
  const prevComposite = readJson(dir, 'composite-risk.json', CompositeFileSchema, null);

  console.log('--- News ---');
  const failedSources: string[] = [];
  const news = await collectFeeds({
    sources: ECON_FEEDS,
    existing: prevNews,
    toRecord: toNewsArticle,
    limit: MAX_NEWS,
    seenIds,
    failedSources,
  });
  if (failedSources.length > 0) errors.push(`RSS failed: ${failedSources.join(', ')}`);

  console.log('--- Indicators ---');
  const indicators = await collectIndicators(prevIndicators, now);
  const unavailable = unavailableIndicators(indicators);
  if (unavailable.length > 0) errors.push(`indicators unavailable or stale: ${unavailable.join(', ')}`);

  let freshRisks: RiskAssessment[] | null = null;
  let summaries: SummarizeResult = { attempted: 0, failed: 0 };
  const llm = detectProvider(env);
  if (llm) {
    console.log(`--- LLM (${llm.provider}): Summarize ---`);
    summaries = await summarize(news, llm);
    if (summaries.failed > 0) errors.push(`${summaries.failed} of ${summaries.attempted} summaries failed`);

    console.log(`--- LLM (${llm.provider}): Risk Assessment ---`);
    try {
      freshRisks = await assess(news, indicators, prevRisks, llm, now);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Assessment failed:', message);
      errors.push(`risk assessment failed: ${message}`);
    }
  } else {
    console.log('No LLM API key set (GROQ_API_KEY or GEMINI_API_KEY); skipping summaries and risk assessment');
  }

  const published = selectPublishedNews(news);
  const events = selectUpcomingEvents(now);
  const files: Record<string, JsonFile> = {
    'news.json': jsonFile(NewsFileSchema, published),
    'seen-ids.json': jsonFile(SeenIdsSchema, nextSeenIds(seenIds, news)),
    'indicators.json': jsonFile(IndicatorsFileSchema, indicators),
    'events.json': jsonFile(EventsFileSchema, events),
  };

  let risks = prevRisks;
  if (freshRisks) {
    risks = mergeRisks(prevRisks, freshRisks);
    files['risks.json'] = jsonFile(RisksFileSchema, risks);
    files['risk-history.json'] = jsonFile(RiskHistoryFileSchema, updateRiskHistory(riskHistory, freshRisks, now));
    const composite = computeComposite(risks, prevComposite?.compositeScore ?? 0);
    if (composite) files['composite-risk.json'] = jsonFile(CompositeFileSchema, composite);
    else errors.push('composite not updated: risk assessments do not cover every category');
  } else if (!prevComposite) {
    // Lets the dashboard show a composite for data that predates composite-risk.json.
    const composite = computeComposite(prevRisks, 0);
    if (composite) files['composite-risk.json'] = jsonFile(CompositeFileSchema, composite);
  }

  writeJsonBatch(dir, files);

  return {
    counts: {
      feeds: ECON_FEEDS.length,
      failedFeeds: failedSources.length,
      articles: published.length,
      summariesAttempted: summaries.attempted,
      summariesFailed: summaries.failed,
      indicators: indicators.length,
      unavailableIndicators: unavailable.length,
      risks: risks.length,
      events: events.length,
    },
    errors,
  };
}

export const source: CollectorSource = { id: 'econ', run };
