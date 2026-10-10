import { logger } from './logger.js';
import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : null;

// CORS — required in production; refuse to start rather than fall back to
// permitting all origins.
if (nodeEnv === 'production' && (!allowedOrigins || allowedOrigins.length === 0)) {
  logger.fatal('[config] ALLOWED_ORIGINS is required in production (comma-separated list of allowed origins)');
  process.exit(1);
}

const DataProviderSchema = z.enum(['csv', 'jquants', 'db', 'edinet', 'composite']);
const dataProvider = DataProviderSchema.safeParse(process.env.DATA_PROVIDER || 'csv');
if (!dataProvider.success) {
  logger.fatal(`[config] DATA_PROVIDER must be one of ${DataProviderSchema.options.join(', ')} (got "${process.env.DATA_PROVIDER}")`);
  process.exit(1);
}

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: parseInt(process.env.PORT || '8902', 10),
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  dataProvider: dataProvider.data,
  marketCapMaxYen: parseFloat(process.env.MARKET_CAP_MAX_YEN || '50000000000'),
  netCashRatioMin: parseFloat(process.env.NET_CASH_RATIO_MIN || '0.3'),
  mvpStockLimit: parseInt(process.env.MVP_STOCK_LIMIT || '30', 10),
  allowedOrigins,
  adminToken: process.env.ADMIN_TOKEN || '',
  jquants: {
    apiKey: process.env.JQUANTS_API_KEY || '',
    mail: process.env.JQUANTS_MAIL_ADDRESS || '',      // deprecated (V1 only)
    password: process.env.JQUANTS_PASSWORD || '',      // deprecated (V1 only)
  },
};
