-- CreateTable
CREATE TABLE "stocks" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sector33Code" TEXT,
    "sector33Name" TEXT,
    "sector17Code" TEXT,
    "marketSegment" TEXT,
    "scaleCategory" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "financial_statements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "typeOfCurrentPeriod" TEXT NOT NULL,
    "disclosedDate" DATETIME NOT NULL,
    "periodEndDate" DATETIME NOT NULL,
    "netSales" REAL,
    "operatingProfit" REAL,
    "ordinaryProfit" REAL,
    "profit" REAL,
    "totalAssets" REAL,
    "equity" REAL,
    "cashAndEquivalents" REAL,
    "sharesOutstanding" REAL,
    CONSTRAINT "financial_statements_code_fkey" FOREIGN KEY ("code") REFERENCES "stocks" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_prices" (
    "code" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "close" REAL NOT NULL,

    PRIMARY KEY ("code", "date"),
    CONSTRAINT "daily_prices_code_fkey" FOREIGN KEY ("code") REFERENCES "stocks" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "screening_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "snapshotAt" DATETIME NOT NULL,
    "marketCap" REAL NOT NULL,
    "netCash" REAL NOT NULL,
    "netCashRatio" REAL NOT NULL,
    "cashNeutralPer" REAL,
    "per" REAL,
    "pbr" REAL,
    CONSTRAINT "screening_snapshots_code_fkey" FOREIGN KEY ("code") REFERENCES "stocks" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "collection_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "financial_statements_code_disclosedDate_idx" ON "financial_statements"("code", "disclosedDate");

-- CreateIndex
CREATE UNIQUE INDEX "financial_statements_code_fiscalYear_typeOfCurrentPeriod_key" ON "financial_statements"("code", "fiscalYear", "typeOfCurrentPeriod");

-- CreateIndex
CREATE INDEX "daily_prices_date_idx" ON "daily_prices"("date");

-- CreateIndex
CREATE INDEX "screening_snapshots_snapshotAt_netCashRatio_idx" ON "screening_snapshots"("snapshotAt", "netCashRatio");

-- CreateIndex
CREATE INDEX "screening_snapshots_snapshotAt_cashNeutralPer_idx" ON "screening_snapshots"("snapshotAt", "cashNeutralPer");

-- CreateIndex
CREATE INDEX "collection_logs_startedAt_idx" ON "collection_logs"("startedAt");
