import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './lib/config.js';
import stocksRoutes from './routes/stocks.js';
import rankingRoutes from './routes/ranking.js';
import adminRoutes from './routes/admin.js';
import strategiesRoutes from './routes/strategies.js';
import { startScheduler } from './jobs/scheduler.js';

const app = express();

app.use(cors({
  origin: config.allowedOrigins ?? true,
}));
app.use(express.json());

app.use('/api/stocks', stocksRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/strategies', strategiesRoutes);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

if (config.nodeEnv === 'production' && !config.allowedOrigins) {
  console.warn('[cors] ALLOWED_ORIGINS not set — all origins permitted');
}
app.listen(config.port, '0.0.0.0', () => {
  console.log(`waga-scope server running on port ${config.port} (provider=${config.dataProvider})`);
  startScheduler();
});
