import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { listRanking } from '../services/screener.js';
import { asyncHandler, BadRequestError } from '../lib/errors.js';

const router: RouterType = Router();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  maxMarketCap: z.coerce.number().positive().optional(),
});

function rankingHandler(metric: 'netCashRatio' | 'cashNeutralPer') {
  return asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
    }
    const rows = await listRanking({
      metric,
      limit: parsed.data.limit,
      maxMarketCap: parsed.data.maxMarketCap,
    });
    res.json(rows);
  });
}

router.get('/net-cash-ratio', rankingHandler('netCashRatio'));
router.get('/cash-neutral-per', rankingHandler('cashNeutralPer'));

export default router;
