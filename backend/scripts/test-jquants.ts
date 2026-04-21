/**
 * Smoke test for JQuantsProvider.
 *
 * Usage:
 *   pnpm -C backend exec tsx scripts/test-jquants.ts
 *
 * Requires backend/.env (or exported env vars):
 *   JQUANTS_MAIL_ADDRESS=your@email.com
 *   JQUANTS_PASSWORD=yourpassword
 *   DATA_PROVIDER=jquants
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load backend/.env before importing config
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mail = process.env.JQUANTS_MAIL_ADDRESS;
const password = process.env.JQUANTS_PASSWORD;

if (!mail || !password) {
  console.error(
    'set JQUANTS_MAIL_ADDRESS and JQUANTS_PASSWORD in backend/.env to test'
  );
  process.exit(0);
}

// Dynamic import after env is loaded
const { JQuantsProvider } = await import('../src/providers/JQuantsProvider.js');
const provider = new JQuantsProvider();

console.log('=== JQuantsProvider smoke test ===\n');

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
