import cron, { type ScheduledTask } from 'node-cron';
import { runCollection, CollectionInProgressError } from '../services/collector.js';

let task: ScheduledTask | null = null;

async function scheduledCollection() {
  try {
    console.log(`[Scheduler] Starting scheduled collection at ${new Date().toISOString()}`);
    await runCollection();
    console.log('[Scheduler] Scheduled collection completed');
  } catch (error) {
    if (error instanceof CollectionInProgressError) {
      console.log('[Scheduler] Collection already running, skipping');
      return;
    }
    console.error('[Scheduler] Collection failed:', error instanceof Error ? error.message : error);
  }
}

export function startScheduler() {
  // Collect news + assess risks at 7:00 and 19:00 JST
  task = cron.schedule('0 7,19 * * *', scheduledCollection, {
    timezone: 'Asia/Tokyo',
  });

  console.log('[Scheduler] Cron jobs scheduled:');
  console.log('  - Data collection: 7:00, 19:00 JST');
}

export function stopScheduler() {
  task?.stop();
  task = null;
}
