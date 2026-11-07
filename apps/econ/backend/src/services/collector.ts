import prisma from '../lib/prisma.js';
import { collectNews, type NewsCollectionResult } from './newsCollector.js';
import { collectIndicators } from './indicatorCollector.js';
import { summarizeUnsummarized, type SummarizeResult } from './summarizer.js';
import { assessRisks } from './riskAssessor.js';
import { getSessionTokenUsage, resetSessionTokenUsage, ensureProviderReady } from './llm.js';

export class CollectionInProgressError extends Error {
  constructor() {
    super('Collection already in progress');
    this.name = 'CollectionInProgressError';
  }
}

interface CollectionResult {
  news: NewsCollectionResult;
  indicators: { collected: number; failed: number };
  summarization: SummarizeResult;
  riskAssessment: { assessed: boolean };
}

// In-process lock: it only protects a single instance. Running several instances
// would need a distributed lock.
let _isRunning = false;

export function isCollectionRunning(): boolean {
  return _isRunning;
}

export async function markStaleRunningLogs(): Promise<number> {
  const result = await prisma.collectionLog.updateMany({
    where: { status: 'running' },
    data: {
      status: 'error',
      completedAt: new Date(),
      message: 'Interrupted: process restarted',
    },
  });
  return result.count;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runCollection(): Promise<CollectionResult> {
  if (_isRunning) {
    throw new CollectionInProgressError();
  }
  _isRunning = true;
  try {
    resetSessionTokenUsage();
    await ensureProviderReady();

    const log = await prisma.collectionLog.create({
      data: {
        jobType: 'full_collection',
        status: 'running',
      },
    });

    try {
      console.log('=== Starting data collection ===');
      const startTime = Date.now();

      // Step 1: Collect news
      console.log('\n--- Collecting news ---');
      const newsResult = await collectNews();

      // Step 2: Collect indicators
      console.log('\n--- Collecting indicators ---');
      const indicatorResult = await collectIndicators();

      const issues: string[] = [];
      if (newsResult.feedsFailed > 0) {
        issues.push(`news sources failed: ${newsResult.feedsFailed}/${newsResult.feedsTotal}`);
      }
      if (indicatorResult.collected === 0) {
        issues.push('no indicators collected');
      } else if (indicatorResult.failed > 0) {
        issues.push(`${indicatorResult.failed} indicator(s) failed`);
      }

      // Step 3: Summarize new articles
      let summaryResult: SummarizeResult = { summarized: 0, failedBatches: 0, pending: 0 };
      try {
        console.log('\n--- Summarizing news ---');
        summaryResult = await summarizeUnsummarized();
        if (summaryResult.failedBatches > 0) {
          issues.push(`summarization incomplete: ${summaryResult.failedBatches} batch(es) failed, ${summaryResult.pending} article(s) pending`);
        }
      } catch (error) {
        console.error('Summarization failed (non-fatal):', errorMessage(error));
        issues.push(`summarization failed: ${errorMessage(error)}`);
      }

      // Step 4: Assess risks
      let riskResult = { assessed: false };
      try {
        console.log('\n--- Assessing risks ---');
        riskResult = await assessRisks();
        if (!riskResult.assessed) {
          issues.push('risk assessment not performed');
        }
      } catch (error) {
        console.error('Risk assessment failed (non-fatal):', errorMessage(error));
        issues.push(`risk assessment failed: ${errorMessage(error)}`);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const tokenUsage = getSessionTokenUsage();
      console.log(`\n=== Collection complete in ${duration}s ===`);
      console.log(`News: ${newsResult.collected} new, ${newsResult.skipped} skipped`);
      console.log(`Indicators: ${indicatorResult.collected} collected, ${indicatorResult.failed} failed`);
      console.log(`Summarized: ${summaryResult.summarized} articles`);
      console.log(`Risk assessed: ${riskResult.assessed}`);
      console.log(`Tokens used: ${tokenUsage.inputTokens} in, ${tokenUsage.outputTokens} out`);

      const summaryLine = `News: ${newsResult.collected}. Summarized: ${summaryResult.summarized}. Risk: ${riskResult.assessed}.`;
      await prisma.collectionLog.update({
        where: { id: log.id },
        data: {
          status: issues.length > 0 ? 'partial' : 'success',
          completedAt: new Date(),
          articlesCollected: newsResult.collected,
          tokensUsed: tokenUsage.inputTokens + tokenUsage.outputTokens,
          message: issues.length > 0 ? `${summaryLine} Issues: ${issues.join('; ')}.` : summaryLine,
        },
      });

      return {
        news: newsResult,
        indicators: indicatorResult,
        summarization: summaryResult,
        riskAssessment: riskResult,
      };
    } catch (error) {
      const message = errorMessage(error);
      console.error('Collection failed:', message);

      try {
        await prisma.collectionLog.update({
          where: { id: log.id },
          data: {
            status: 'error',
            completedAt: new Date(),
            message,
          },
        });
      } catch (updateError) {
        console.error('Failed to record collection failure:', errorMessage(updateError));
      }

      throw error;
    }
  } finally {
    _isRunning = false;
  }
}
