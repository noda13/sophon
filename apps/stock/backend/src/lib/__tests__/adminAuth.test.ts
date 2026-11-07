import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const cfg = vi.hoisted(() => ({ adminToken: '', nodeEnv: 'development' }));
vi.mock('../config.js', () => ({ config: cfg }));

import { requireAdminToken } from '../adminAuth.js';

const app = express();
app.get('/admin', requireAdminToken, (_req, res) => {
  res.json({ ok: true });
});

describe('requireAdminToken', () => {
  beforeEach(() => {
    cfg.adminToken = 'secret';
    cfg.nodeEnv = 'development';
  });

  it('returns 503 when ADMIN_TOKEN is unset, even outside production', async () => {
    cfg.adminToken = '';
    const res = await request(app).get('/admin');
    expect(res.status).toBe(503);
  });

  it('returns 503 when unset in production', async () => {
    cfg.adminToken = '';
    cfg.nodeEnv = 'production';
    const res = await request(app).get('/admin').set('Authorization', 'Bearer ');
    expect(res.status).toBe(503);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong token', async () => {
    const res = await request(app).get('/admin').set('Authorization', 'Bearer wrong!');
    expect(res.status).toBe(401);
  });

  it('passes with the correct token', async () => {
    const res = await request(app).get('/admin').set('Authorization', 'Bearer secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
