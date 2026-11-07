import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './lib/errors.js';
import stocksRoutes from './routes/stocks.js';
import rankingRoutes from './routes/ranking.js';
import adminRoutes from './routes/admin.js';
import strategiesRoutes from './routes/strategies.js';

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({
    origin: config.allowedOrigins ?? true,
  }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/stocks', stocksRoutes);
  app.use('/api/ranking', rankingRoutes);
  app.use('/api/admin', rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }), adminRoutes);
  app.use('/api/strategies', strategiesRoutes);

  app.use(errorHandler);

  return app;
}
