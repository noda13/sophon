import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { runSync, isSyncing } from '../services/syncOrchestrator.js';

// Daily at 17:00 JST (08:00 UTC when TZ=Asia/Tokyo)
export function startScheduler(): void {
  cron.schedule('0 17 * * *', async () => {
    if (isSyncing()) {
      logger.info('[scheduler] Skipping — sync already in progress');
      return;
    }
    logger.info('[scheduler] Starting daily sync...');
    try {
      const result = await runSync();
      logger.info(`[scheduler] Sync complete: ${result.stocks} stocks, ${result.snapshots} snapshots`);
    } catch (err) {
      logger.error({ err }, '[scheduler] Sync failed');
    }
  }, {
    timezone: 'Asia/Tokyo',
  });

  logger.info('[scheduler] Daily sync scheduled at 17:00 JST');
}
