import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import prisma from '../../lib/prisma.js';
import { createApp } from '../../app.js';
import { resetDb } from '../../../test/db.js';

const app = createApp();

async function seed(code: string, name: string, sector: string, caps: [number, number][]) {
  await prisma.stock.create({ data: { code, name, sector33Name: sector } });
  for (const [day, marketCap] of caps) {
    await prisma.screeningSnapshot.create({
      data: { code, snapshotAt: new Date(Date.UTC(2026, 0, day)), marketCap, netCash: 0, netCashRatio: 0 },
    });
  }
}

const codes = (body: { code: string }[]) => body.map(s => s.code);

describe('GET /api/stocks', () => {
  beforeEach(async () => {
    await resetDb();
    await seed('1001', 'Charlie', '電気機器', [[1, 100], [3, 300]]);
    await seed('1002', 'Alpha', '電気機器', [[1, 500]]);
    await seed('1003', 'Bravo', '銀行業', [[2, 200]]);
    await seed('1004', 'Delta', '銀行業', []);
  });

  it('orders by code by default with the latest snapshot', async () => {
    const res = await request(app).get('/api/stocks');
    expect(res.status).toBe(200);
    expect(codes(res.body)).toEqual(['1001', '1002', '1003', '1004']);
    expect(res.body[0].snapshots).toHaveLength(1);
    expect(res.body[0].snapshots[0].marketCap).toBe(300);
  });

  it('orders by name', async () => {
    const res = await request(app).get('/api/stocks?orderBy=name');
    expect(res.body.map((s: { name: string }) => s.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  });

  it('orders by latest marketCap desc with snapshot-less stocks last', async () => {
    const res = await request(app).get('/api/stocks?orderBy=marketCap');
    expect(codes(res.body)).toEqual(['1002', '1001', '1003', '1004']);
    expect(res.body[1].snapshots[0].marketCap).toBe(300);
  });

  it('paginates and filters by sector with marketCap ordering', async () => {
    const res = await request(app).get('/api/stocks?orderBy=marketCap&limit=1');
    expect(codes(res.body)).toEqual(['1002']);

    const bank = await request(app).get('/api/stocks?orderBy=marketCap&sector=銀行');
    expect(codes(bank.body)).toEqual(['1003', '1004']);
  });

  it('rejects invalid query', async () => {
    expect((await request(app).get('/api/stocks?limit=0')).status).toBe(400);
  });

  it('returns a stock, 404 for unknown, 400 for malformed code', async () => {
    const ok = await request(app).get('/api/stocks/1001');
    expect(ok.status).toBe(200);
    expect(ok.body.code).toBe('1001');
    expect((await request(app).get('/api/stocks/9999')).status).toBe(404);
    expect((await request(app).get('/api/stocks/9999/history')).status).toBe(404);
    expect((await request(app).get('/api/stocks/abc')).status).toBe(400);
  });
});
