import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

export function requireAdminToken(_req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    // No token configured — allow (dev/local mode)
    next();
    return;
  }
  const auth = _req.headers.authorization;
  if (auth !== `Bearer ${config.adminToken}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
