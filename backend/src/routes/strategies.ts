import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { strategies, getStrategy } from '../strategies/index.js';
import { rankByStrategyId } from '../services/screener.js';

const router: RouterType = Router();

const rankQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  maxMarketCap: z.coerce.number().positive().optional(),
  minMarketCap: z.coerce.number().positive().optional(),
  excludeSectors: z.string().optional(),
});

// GET /api/strategies — all strategies (including inactive)
router.get('/', (_req, res) => {
  res.json(strategies.map(s => s.meta));
});

// GET /api/strategies/:id/ranking
router.get('/:id/ranking', async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = getStrategy(id);
    if (!strategy) {
      res.status(404).json({ error: `Strategy not found: ${id}` });
      return;
    }
    if (!strategy.meta.active) {
      res.status(400).json({ error: `Strategy ${id} is not active in Phase 1` });
      return;
    }

    const parsed = rankQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const excludeSectors = parsed.data.excludeSectors
      ? parsed.data.excludeSectors.split(',').map(s => s.trim())
      : undefined;

    const rows = await rankByStrategyId(id, {
      limit: parsed.data.limit,
      maxMarketCap: parsed.data.maxMarketCap,
      minMarketCap: parsed.data.minMarketCap,
      excludeSectors,
    });

    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
