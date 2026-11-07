import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();

if (config.nodeEnv !== 'production' && !config.allowedOrigins) {
  logger.warn('[cors] ALLOWED_ORIGINS not set — all origins permitted (development only)');
}
if (!config.adminToken) {
  logger.warn('[admin] ADMIN_TOKEN not set — /api/admin/* will respond 503');
}
app.listen(config.port, config.host, () => {
  logger.info(`waga-scope server running on ${config.host}:${config.port} (provider=${config.dataProvider})`);
  startScheduler();
});
