import { Router, type Router as RouterType } from 'express';
import prisma from '../lib/prisma.js';
import { runSync, isSyncing } from '../services/syncOrchestrator.js';
import { requireAdminToken } from '../lib/adminAuth.js';

const router: RouterType = Router();

router.use(requireAdminToken);

router.post('/sync', async (_req, res) => {
  if (isSyncing()) {
    res.status(409).json({ error: 'Sync already in progress' });
    return;
  }
  try {
    const result = await runSync();
    res.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/status', async (_req, res) => {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
