import cron from 'node-cron';
import { runCollection, isRunning } from '../services/collector.js';

// Schedule: 7:00 and 19:00 JST (UTC+9 → UTC 22:00 and 10:00 previous day)
// Expressed in JST using TZ option
const CRON_EXPRESSION = '0 7,19 * * *';
const TIMEZONE = 'Asia/Tokyo';

export function startScheduler(): void {
  console.log(`[Scheduler] Starting scheduler. Cron: "${CRON_EXPRESSION}" (${TIMEZONE})`);

  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      console.log('[Scheduler] Cron triggered. Starting collection...');

      if (isRunning) {
        console.log('[Scheduler] Collection already running. Skipping this run.');
        return;
      }

      try {
        const result = await runCollection();
        console.log('[Scheduler] Scheduled collection complete.', result);
      } catch (error) {
        console.error('[Scheduler] Scheduled collection failed:', String(error));
      }
    },
    {
      timezone: TIMEZONE,
    },
  );

  console.log('[Scheduler] Scheduler started successfully.');
}
