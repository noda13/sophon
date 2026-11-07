import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { INDICATOR_CODES } from '../services/indicatorCollector.js';

const router: Router = Router();

// GET /api/indicators - Get latest value of each indicator
router.get('/', asyncHandler(async (_req, res) => {
  const latest = await Promise.all(
    INDICATOR_CODES.map((code) =>
      prisma.economicIndicator.findFirst({
        where: { code },
        orderBy: { recordedAt: 'desc' },
      })
    )
  );

  res.json(latest.filter((indicator) => indicator !== null));
}));

export default router;
