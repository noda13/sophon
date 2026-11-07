import { Router, type Router as RouterType } from 'express';
import prisma from '../lib/prisma.js';
import { runSync, isSyncing } from '../services/syncOrchestrator.js';
import { requireAdminToken } from '../lib/adminAuth.js';
import { asyncHandler, ConflictError } from '../lib/errors.js';

const router: RouterType = Router();

router.use(requireAdminToken);

router.post('/sync', asyncHandler(async (_req, res) => {
  if (isSyncing()) {
    throw new ConflictError('Sync already in progress');
  }
  const result = await runSync();
  res.json({ success: true, ...result });
}));

router.get('/status', asyncHandler(async (_req, res) => {
  const lastLog = await prisma.collectionLog.findFirst({
    orderBy: { startedAt: 'desc' },
  });
  const stocks = await prisma.stock.count();
  const snapshots = await prisma.screeningSnapshot.count();
  res.json({
    syncInProgress: isSyncing(),
    lastLog,
    counts: { stocks, snapshots },
  });
}));

export default router;
