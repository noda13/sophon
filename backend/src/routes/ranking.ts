import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { listRanking } from '../services/screener.js';

const router: RouterType = Router();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  maxMarketCap: z.coerce.number().positive().optional(),
});

router.get('/net-cash-ratio', async (req, res) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rows = await listRanking({
      metric: 'netCashRatio',
      limit: parsed.data.limit,
      maxMarketCap: parsed.data.maxMarketCap,
    });
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/cash-neutral-per', async (req, res) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rows = await listRanking({
      metric: 'cashNeutralPer',
      limit: parsed.data.limit,
      maxMarketCap: parsed.data.maxMarketCap,
    });
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
