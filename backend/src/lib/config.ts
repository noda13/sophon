import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8902', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  dataProvider: (process.env.DATA_PROVIDER || 'csv') as 'csv' | 'jquants' | 'edinet' | 'composite',
  marketCapMaxYen: parseFloat(process.env.MARKET_CAP_MAX_YEN || '50000000000'),
  netCashRatioMin: parseFloat(process.env.NET_CASH_RATIO_MIN || '0.3'),
  mvpStockLimit: parseInt(process.env.MVP_STOCK_LIMIT || '30', 10),
  jquants: {
    apiKey: process.env.JQUANTS_API_KEY || '',
    mail: process.env.JQUANTS_MAIL_ADDRESS || '',      // deprecated (V1 only)
    password: process.env.JQUANTS_PASSWORD || '',      // deprecated (V1 only)
  },
};
