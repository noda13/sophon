import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    res.status(503).json({ error: 'Admin endpoint disabled: ADMIN_TOKEN not configured' });
    return;
  }
  const provided = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${config.adminToken}`);
  // timingSafeEqual prevents timing-based token enumeration
  const match = provided.length === expected.length && timingSafeEqual(provided, expected);
  if (!match) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
