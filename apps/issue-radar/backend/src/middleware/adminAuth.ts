import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import { config } from '../lib/config.js';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function adminAuth(_req: Request, res: Response, next: NextFunction): void {
  const adminKey = config.adminApiKey;

  if (!adminKey) {
    // Fail closed: return 503 rather than allowing unauthenticated access
    res.status(503).json({ error: 'Admin API not configured' });
    return;
  }

  const auth = _req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!timingSafeEqual(sha256(token), sha256(adminKey))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
