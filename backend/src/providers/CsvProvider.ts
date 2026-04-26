import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DataProvider, StockInfo, StatementRaw, PriceRaw } from './DataProvider.js';

interface CsvRow {
  code: string;
  name: string;
  sector33Name: string;
  marketSegment: string;
  sharesOutstanding: number;
  closePrice: number;
  priceDate: Date;
  fiscalYear: number;
  typeOfCurrentPeriod: string;
  disclosedDate: Date;
  periodEndDate: Date;
  netSales: number | null;
  operatingProfit: number | null;
  profit: number | null;
  totalAssets: number | null;
  equity: number | null;
  currentAssets: number | null;
  cashAndEquivalents: number | null;
}

function parseNum(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'NA') return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

function parseDate(s: string): Date {
  return new Date(s.trim());
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  // skip header
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return {
      code: cols[0],
      name: cols[1],
      sector33Name: cols[2],
      marketSegment: cols[3],
      sharesOutstanding: parseFloat(cols[4]),
      closePrice: parseFloat(cols[5]),
      priceDate: parseDate(cols[6]),
      fiscalYear: parseInt(cols[7], 10),
      typeOfCurrentPeriod: cols[8],
      disclosedDate: parseDate(cols[9]),
      periodEndDate: parseDate(cols[10]),
      netSales: parseNum(cols[11]),
      operatingProfit: parseNum(cols[12]),
      profit: parseNum(cols[13]),
      totalAssets: parseNum(cols[14]),
      equity: parseNum(cols[15]),
      currentAssets: parseNum(cols[16]),
      cashAndEquivalents: parseNum(cols[17]),
    };
  });
}

export class CsvProvider implements DataProvider {
  name = 'csv';
  private rows: CsvRow[];

  constructor() {
    // Resolve CSV path — try multiple locations for monorepo compatibility
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      // When running from backend/ dir
      resolve(process.cwd(), 'seed', 'stocks.csv'),
      // When running from monorepo root (scripts/collect-static.ts)
      resolve(process.cwd(), 'backend', 'seed', 'stocks.csv'),
      // Relative to CsvProvider.ts: backend/src/providers/ → ../../seed/
      resolve(__dirname, '..', '..', 'seed', 'stocks.csv'),
    ];

    let csvPath: string | null = null;
    for (const candidate of candidates) {
      try {
        readFileSync(candidate); // test if readable
        csvPath = candidate;
        break;
      } catch {
        // try next
      }
    }
    if (!csvPath) {
      throw new Error(
        `stocks.csv not found. Tried:\n${candidates.join('\n')}`
      );
    }
    const content = readFileSync(csvPath, 'utf-8');
    this.rows = parseCsv(content);
  }

  async listStocks(): Promise<StockInfo[]> {
    const seen = new Set<string>();
    const stocks: StockInfo[] = [];
    for (const row of this.rows) {
      if (!seen.has(row.code)) {
        seen.add(row.code);
        stocks.push({
          code: row.code,
          name: row.name,
          sector33Name: row.sector33Name || undefined,
          marketSegment: row.marketSegment || undefined,
          sharesOutstanding: row.sharesOutstanding,
        });
      }
    }
    return stocks;
  }

  async fetchStatements(code: string): Promise<StatementRaw[]> {
    return this.rows
      .filter(r => r.code === code)
      .map(r => ({
        code: r.code,
        fiscalYear: r.fiscalYear,
        typeOfCurrentPeriod: r.typeOfCurrentPeriod,
        disclosedDate: r.disclosedDate,
        periodEndDate: r.periodEndDate,
        netSales: r.netSales,
        operatingProfit: r.operatingProfit,
        profit: r.profit,
        totalAssets: r.totalAssets,
        equity: r.equity,
        currentAssets: r.currentAssets,
        cashAndEquivalents: r.cashAndEquivalents,
        sharesOutstanding: r.sharesOutstanding,
      }));
  }

  async fetchPrices(code: string): Promise<PriceRaw[]> {
    return this.rows
      .filter(r => r.code === code)
      .map(r => ({
        code: r.code,
        date: r.priceDate,
        close: r.closePrice,
      }));
  }
}
