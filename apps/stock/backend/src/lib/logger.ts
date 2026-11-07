import 'dotenv/config';
import pino from 'pino';

const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
const isDev = (process.env.NODE_ENV || 'development') === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev && !isTest
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});
