/**
 * Smoke test and discovery tool for JQuantsProvider (V2 API).
 *
 * Usage (smoke test):
 *   pnpm -C backend exec tsx scripts/test-jquants.ts
 *
 * Usage (discovery — dump raw first item from each endpoint):
 *   pnpm -C backend exec tsx scripts/test-jquants.ts --discover
 *
 * Requires backend/.env:
 *   JQUANTS_API_KEY=<your key from https://jpx-jquants.com/ dashboard>
 *   DATA_PROVIDER=jquants
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load backend/.env before importing config
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.JQUANTS_API_KEY;
const discover = process.argv.includes('--discover');

if (!apiKey) {
  console.error(
    '\n[jquants] JQUANTS_API_KEY is not set.\n' +
      'Set it in backend/.env:\n' +
      '  JQUANTS_API_KEY=<your key from https://jpx-jquants.com/ dashboard>\n\n' +
      'V2 API (released 2025-12-22) uses an API key instead of mail+password.\n'
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Discovery mode: raw fetch, dump first item of each endpoint
// ---------------------------------------------------------------------------

if (discover) {
  const BASE = 'https://api.jquants.com/v2';
  const headers = { 'x-api-key': apiKey };

  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - 20 * 7 * 24 * 3_600_000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  const endpoints: Array<{ label: string; url: string }> = [
    { label: '/v2/equities/master', url: `${BASE}/equities/master` },
    { label: '/v2/fins/summary (code=72030)', url: `${BASE}/fins/summary?code=72030` },
    {
      label: '/v2/equities/bars/daily (code=72030)',
      url: `${BASE}/equities/bars/daily?code=72030&from=${fmt(fromDate)}&to=${fmt(toDate)}`,
    },
  ];

  console.log('=== J-Quants V2 API Discovery Mode ===\n');
  console.log('Hitting each endpoint once and dumping the first item of data[].\n');
  console.log('Share this output to verify field names match expected values.\n');

  for (const ep of endpoints) {
    console.log(`=== ${ep.label} ===`);
    try {
      const res = await fetch(ep.url, { method: 'GET', headers });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`  HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
        continue;
      }
      const json = (await res.json()) as Record<string, unknown>;
      const data = json['data'] as unknown[] | undefined;
      if (!data || data.length === 0) {
        console.log('  data[] is empty or missing. Full response:');
        console.log(JSON.stringify(json, null, 2));
      } else {
        console.log(`  data[] length: ${data.length}`);
        console.log('  First item:');
        console.log(JSON.stringify(data[0], null, 2));
      }
      if (json['pagination_key']) {
        console.log(`  pagination_key present: ${json['pagination_key']}`);
      }
    } catch (err) {
      console.error('  fetch error:', err);
    }
    console.log('');
  }

  console.log('=== Discovery complete ===');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Smoke test: use JQuantsProvider
// ---------------------------------------------------------------------------

// Dynamic import after env is loaded
const { JQuantsProvider } = await import('../src/providers/JQuantsProvider.js');
const provider = new JQuantsProvider();

console.log('=== JQuantsProvider V2 smoke test ===\n');

// 1. listStocks
console.log('--- listStocks() (first 3 results) ---');
try {
  const stocks = await provider.listStocks();
  console.log(`Total stocks: ${stocks.length}`);
  stocks.slice(0, 3).forEach((s) => console.log(JSON.stringify(s, null, 2)));
} catch (err) {
  console.error('listStocks() failed:', err);
  process.exit(1);
}

console.log('');

// 2. fetchStatements for トヨタ (7203)
console.log('--- fetchStatements("7203") (first 2 results) ---');
try {
  const stmts = await provider.fetchStatements('7203');
  console.log(`Total statements: ${stmts.length}`);
  stmts.slice(0, 2).forEach((s) => console.log(JSON.stringify(s, null, 2)));
} catch (err) {
  console.error('fetchStatements() failed:', err);
  process.exit(1);
}

console.log('');

// 3. fetchPrices for トヨタ (7203) — latest close
console.log('--- fetchPrices("7203") (latest close) ---');
try {
  const prices = await provider.fetchPrices('7203');
  console.log(`Total price records: ${prices.length}`);
  if (prices.length > 0) {
    const latest = prices.reduce((a, b) => (a.date > b.date ? a : b));
    // NOTE: J-Quants Free tier has a 12-week lag — this is the most recent available price,
    // not today's price.
    console.log(
      `Latest available close (12-week lag): ${latest.date.toISOString().slice(0, 10)} → ¥${latest.close}`
    );
  } else {
    console.log('No price records returned (possibly no data for this period)');
  }
} catch (err) {
  console.error('fetchPrices() failed:', err);
  process.exit(1);
}

console.log('\n=== All tests passed ===');
