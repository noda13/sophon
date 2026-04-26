import cron from 'node-cron';
import { runSync, isSyncing } from '../services/syncOrchestrator.js';

// Daily at 17:00 JST (08:00 UTC when TZ=Asia/Tokyo)
export function startScheduler(): void {
  cron.schedule('0 17 * * *', async () => {
    if (isSyncing()) {
      console.log('[scheduler] Skipping — sync already in progress');
      return;
    }
    console.log('[scheduler] Starting daily sync...');
    try {
      const result = await runSync();
      console.log(`[scheduler] Sync complete: ${result.stocks} stocks, ${result.snapshots} snapshots`);
    } catch (err) {
      console.error('[scheduler] Sync failed:', err);
    }
  }, {
    timezone: 'Asia/Tokyo',
  });

  console.log('[scheduler] Daily sync scheduled at 17:00 JST');
}
