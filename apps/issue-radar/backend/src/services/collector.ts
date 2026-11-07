import { collectIssues } from './issueCollector.js';
import { classifyIssues } from './classifier.js';
import { generateIdeas } from './ideaGenerator.js';
import prisma from '../lib/prisma.js';

export let isRunning = false;

export interface CollectionResult {
  collected: number;
  skipped: number;
  classified: number;
  generated: number;
  totalTokens: number;
}

export async function runCollection(): Promise<CollectionResult> {
  if (isRunning) {
    throw new Error('Collection is already running');
  }

  isRunning = true;
  const startedAt = new Date();
  let logId: number | null = null;

  try {
    // Create a log entry
    const log = await prisma.collectionLog.create({
      data: {
        jobType: 'full_collection',
        status: 'running',
        message: 'Collection started',
        startedAt,
      },
    });
    logId = log.id;

    console.log('[Collector] Step 1/3: Collecting issues from RSS feeds...');
    const { collected, skipped } = await collectIssues();

    console.log('[Collector] Step 2/3: Classifying issues with LLM...');
    const { classified, tokensUsed: classifyTokens } = await classifyIssues();

    console.log('[Collector] Step 3/3: Generating app ideas...');
    const { generated, tokensUsed: ideaTokens } = await generateIdeas();

    const totalTokens = classifyTokens + ideaTokens;
    const result: CollectionResult = {
      collected,
      skipped,
      classified,
      generated,
      totalTokens,
    };

    // Update log entry to completed
    await prisma.collectionLog.update({
      where: { id: logId },
      data: {
        status: 'completed',
        message: `collected=${collected}, skipped=${skipped}, classified=${classified}, generated=${generated}, tokens=${totalTokens}`,
        completedAt: new Date(),
        itemsProcessed: collected + classified + generated,
        tokensUsed: totalTokens,
      },
    });

    console.log('[Collector] Collection complete.', result);
    return result;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    // Truncate to avoid persisting potentially sensitive upstream error bodies
    const message = rawMessage.slice(0, 500).replace(/[\x00-\x1f]/g, ' ');
    console.error(`[Collector] Collection failed: ${message}`);

    if (logId !== null) {
      await prisma.collectionLog
        .update({
          where: { id: logId },
          data: {
            status: 'failed',
            message,
            completedAt: new Date(),
          },
        })
        .catch((dbErr: unknown) => {
          console.error(`[Collector] Failed to update log: ${String(dbErr)}`);
        });
    }

    throw error;
  } finally {
    isRunning = false;
  }
}
