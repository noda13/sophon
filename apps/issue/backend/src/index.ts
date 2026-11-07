import 'dotenv/config';
import express from 'express';
import { config } from './lib/config.js';
import adminRouter from './routes/admin.js';
import issuesRouter from './routes/issues.js';
import ideasRouter from './routes/ideas.js';
import { startScheduler } from './jobs/scheduler.js';
import { adminAuth } from './middleware/adminAuth.js';
import prisma from './lib/prisma.js';

const app = express();

// Middleware
app.use(express.json());

// CORS: allow only configured origins
const CORS_ORIGINS = (config.corsOrigins ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use((_req, res, next) => {
  const origin = _req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Handle OPTIONS preflight
app.options('*', (_req, res) => {
  res.sendStatus(204);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Routes
app.use('/api/admin', adminAuth, adminRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/ideas', ideasRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[Express] Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  },
);

// Start server
const server = app.listen(config.port, () => {
  console.log(`[Server] issue-radar backend listening on port ${config.port}`);
  console.log(`[Server] Health check: http://localhost:${config.port}/health`);
});

// Start scheduler
startScheduler();

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[Process] Received ${signal}, shutting down gracefully...`);
  // Wait for in-flight HTTP requests to complete before disconnecting Prisma
  await new Promise<void>((resolve) => server.close(() => {
    console.log('[Process] HTTP server closed.');
    resolve();
  }));
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect errors during shutdown
  }
  // Exit non-zero for all unclean signals so process supervisors treat them as crashes
  const isUnclean = signal === 'uncaughtException' || signal === 'unhandledRejection';
  process.exit(isUnclean ? 1 : 0);
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err.message);
  console.error(err.stack);
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', String(reason));
  // Treat unhandled rejections as fatal — exit so a supervisor can restart cleanly
  void shutdown('unhandledRejection');
});
