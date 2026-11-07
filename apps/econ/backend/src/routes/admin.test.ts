import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: { adminSecret: '' },
  isCollectionRunning: vi.fn(() => false),
  runCollection: vi.fn(async () => ({})),
}));

vi.mock('../lib/config.js', () => ({ config: mocks.config }));
vi.mock('../lib/prisma.js', () => ({
  default: {
    collectionLog: { findFirst: vi.fn(async () => null) },
    newsArticle: { count: vi.fn(async () => 0) },
  },
}));
vi.mock('../services/collector.js', () => {
  class CollectionInProgressError extends Error {}
  return {
    CollectionInProgressError,
    isCollectionRunning: mocks.isCollectionRunning,
    runCollection: mocks.runCollection,
  };
});

import adminRoutes from './admin.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/admin', adminRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  mocks.config.adminSecret = 'correct-secret';
  mocks.isCollectionRunning.mockReturnValue(false);
  mocks.runCollection.mockClear();
});

const get = (headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/api/admin/status`, { headers });

describe('adminAuth', () => {
  it('returns 503 when ADMIN_SECRET is not configured, even with a header', async () => {
    mocks.config.adminSecret = '';
    expect((await get()).status).toBe(503);
    expect((await get({ 'x-admin-key': '' })).status).toBe(503);
  });

  it('returns 401 when the key is missing', async () => {
    expect((await get()).status).toBe(401);
  });

  it('returns 401 for a wrong key of the same length', async () => {
    expect((await get({ 'x-admin-key': 'wrong-secret!!' })).status).toBe(401);
  });

  it('returns 401 for a key of a different length', async () => {
    expect((await get({ 'x-admin-key': 'x' })).status).toBe(401);
  });

  it('returns 401 for a multibyte key without throwing', async () => {
    const res = await get({ 'x-admin-key': encodeURIComponent('秘密') });
    expect(res.status).toBe(401);
  });

  it('passes the correct key through to the handler', async () => {
    const res = await get({ 'x-admin-key': 'correct-secret' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lastCollection: null, stats: { totalArticles: 0, unsummarized: 0 } });
  });
});

describe('POST /collect', () => {
  const post = () =>
    fetch(`${baseUrl}/api/admin/collect`, { method: 'POST', headers: { 'x-admin-key': 'correct-secret' } });

  it('starts a collection and returns 202', async () => {
    const res = await post();
    expect(res.status).toBe(202);
    expect(mocks.runCollection).toHaveBeenCalledTimes(1);
  });

  it('returns 409 without starting when a collection is already running', async () => {
    mocks.isCollectionRunning.mockReturnValue(true);
    const res = await post();
    expect(res.status).toBe(409);
    expect(mocks.runCollection).not.toHaveBeenCalled();
  });
});
