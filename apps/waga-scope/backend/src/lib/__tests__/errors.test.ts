import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { asyncHandler, errorHandler, NotFoundError, BadRequestError, ConflictError } from '../errors.js';

const app = express();
app.use(express.json({ limit: '1kb' }));
app.get('/not-found', asyncHandler(async () => {
  throw new NotFoundError('Stock 1234 not found');
}));
app.get('/bad', asyncHandler(async () => {
  throw new BadRequestError('bad input');
}));
app.get('/conflict', asyncHandler(async () => {
  throw new ConflictError('busy');
}));
app.get('/boom', asyncHandler(async () => {
  throw new Error('SQLITE_ERROR: secret internals');
}));
app.get('/ok', asyncHandler(async (_req, res) => {
  res.json({ ok: true });
}));
app.post('/echo', (req, res) => {
  res.json(req.body);
});
app.use(errorHandler);

describe('errorHandler', () => {
  it('maps typed errors to their status and message', async () => {
    const nf = await request(app).get('/not-found');
    expect(nf.status).toBe(404);
    expect(nf.body).toEqual({ error: 'Stock 1234 not found' });
    expect((await request(app).get('/bad')).status).toBe(400);
    expect((await request(app).get('/conflict')).status).toBe(409);
  });

  it('does not leak raw messages of unexpected errors', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('SQLITE');
  });

  it('leaves success responses untouched', async () => {
    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 400 for malformed JSON and 413 for oversized bodies', async () => {
    const bad = await request(app).post('/echo').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    const big = await request(app).post('/echo').send({ a: 'x'.repeat(5000) });
    expect(big.status).toBe(413);
  });
});
