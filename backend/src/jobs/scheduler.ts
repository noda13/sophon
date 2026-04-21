import cron from 'node-cron';
import { runSync } from '../services/syncOrchestrator.js';

let schedulerRunning = false;

// Daily at 17:00 JST (08:00 UTC when TZ=Asia/Tokyo)
export function startScheduler(): void {
  cron.schedule('0 17 * * *', async () => {
    if (schedulerRunning) {
      console.log('[scheduler] Skipping — sync already in progress');
      return;
    }
    schedulerRunning = true;
    console.log('[scheduler] Starting daily sync...');
    try {
      const result = await runSync();
      console.log(`[scheduler] Sync complete: ${result.stocks} stocks, ${result.snapshots} snapshots`);
    } catch (err) {
      console.error('[scheduler] Sync failed:', err);
    } finally {
      schedulerRunning = false;
    }
  }, {
    timezone: 'Asia/Tokyo',
  });

  console.log('[scheduler] Daily sync scheduled at 17:00 JST');
}
