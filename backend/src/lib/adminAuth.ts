import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

export function requireAdminToken(_req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    if (config.nodeEnv === 'production') {
      res.status(503).json({ error: 'Admin endpoint disabled: ADMIN_TOKEN not configured' });
      return;
    }
    next();
    return;
  }
  const auth = _req.headers.authorization;
  const provided = Buffer.from(auth ?? '');
  const expected = Buffer.from(`Bearer ${config.adminToken}`);
  // Use timingSafeEqual to prevent timing-based token enumeration attacks
  const match = provided.length === expected.length && timingSafeEqual(provided, expected);
  if (!match) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
