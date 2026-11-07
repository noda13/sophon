import { Router, type Router as RouterType, type Request, type Response } from 'express';
import { runCollection, isRunning } from '../services/collector.js';
import prisma from '../lib/prisma.js';

const router: RouterType = Router();

// POST /api/admin/collect
router.post('/collect', async (_req: Request, res: Response): Promise<void> => {
  if (isRunning) {
    res.status(409).json({
      error: 'Collection is already running',
      isRunning: true,
    });
    return;
  }

  try {
    // Run collection in background; return immediately with acknowledgement
    // to avoid HTTP timeout on long-running jobs
    res.status(202).json({ message: 'Collection started', isRunning: true });

    // Fire and forget (errors logged internally)
    runCollection().catch((err) => {
      console.error('[Admin] Collection error:', String(err));
    });
  } catch (error) {
    console.error('[Admin]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/logs
router.get('/logs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const logs = await prisma.collectionLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    res.json({ logs });
  } catch (error) {
    console.error('[Admin]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/status
router.get('/status', (_req: Request, res: Response): void => {
  res.json({ isRunning });
});

export default router;
