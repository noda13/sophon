import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

export function requireAdminToken(_req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    if (config.nodeEnv === 'production') {
      console.warn('[adminAuth] WARNING: ADMIN_TOKEN not set in production — all admin requests permitted');
    }
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
