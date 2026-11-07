import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { runCollection, isCollectionRunning, CollectionInProgressError } from '../services/collector.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';

const router: Router = Router();

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = config.adminSecret;
  if (!secret) {
    res.status(503).json({ error: 'Admin routes are disabled: ADMIN_SECRET is not configured' });
    return;
  }
  const provided = req.headers['x-admin-key'];
  // Hash both values to a fixed-length digest before comparing so that
  // timingSafeEqual never throws a RangeError (multibyte chars can make
  // Buffer byte length differ from JS string length) and no secret-length
  // information leaks via an early-exit branch.
  const a = crypto.createHash('sha256').update(typeof provided === 'string' ? provided : '').digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  if (typeof provided !== 'string' || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(adminAuth);

// GET /api/admin/status - Get last collection status
router.get('/status', asyncHandler(async (_req, res) => {
  const lastLog = await prisma.collectionLog.findFirst({
    orderBy: { startedAt: 'desc' },
  });

  const articleCount = await prisma.newsArticle.count();
  const unsummarizedCount = await prisma.newsArticle.count({
    where: { summaryJa: '' },
  });

  res.json({
    lastCollection: lastLog,
    stats: {
      totalArticles: articleCount,
      unsummarized: unsummarizedCount,
    },
  });
}));

// POST /api/admin/collect - Start data collection in the background; poll GET /status for the outcome
router.post('/collect', asyncHandler(async (_req, res) => {
  if (isCollectionRunning()) {
    res.status(409).json({ error: 'Collection already in progress' });
    return;
  }

  runCollection().catch((error: unknown) => {
    if (error instanceof CollectionInProgressError) return;
    console.error('[Admin] Background collection failed:', error instanceof Error ? error.message : error);
  });

  res.status(202).json({ message: 'Collection started' });
}));

export default router;
