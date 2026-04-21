export interface StockInfo {
  code: string;
  name: string;
  sector33Name?: string;
  sector33Code?: string;
  sector17Code?: string;
  marketSegment?: string;
  scaleCategory?: string;
  sharesOutstanding: number;
}

export interface StatementRaw {
  code: string;
  fiscalYear: number;
  typeOfCurrentPeriod: string;
  disclosedDate: Date;
  periodEndDate: Date;
  netSales?: number | null;
  operatingProfit?: number | null;
  ordinaryProfit?: number | null;
  profit?: number | null;
  totalAssets?: number | null;
  equity?: number | null;
  cashAndEquivalents?: number | null;
  sharesOutstanding?: number | null;
}

export interface PriceRaw {
  code: string;
  date: Date;
  close: number;
}

export interface DataProvider {
  name: string;
  listStocks(): Promise<StockInfo[]>;
  fetchStatements(code: string, opts?: { limit?: number }): Promise<StatementRaw[]>;
  fetchPrices(code: string, opts?: { from?: Date; to?: Date }): Promise<PriceRaw[]>;
}
