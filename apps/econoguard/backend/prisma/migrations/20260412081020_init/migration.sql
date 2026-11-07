-- CreateTable
CREATE TABLE "news_articles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "summaryJa" TEXT NOT NULL DEFAULT '',
    "relevanceScore" REAL NOT NULL DEFAULT 0,
    "riskCategories" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "economic_indicators" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "previousValue" REAL,
    "unit" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "summaryJa" TEXT NOT NULL,
    "factorsJa" TEXT NOT NULL,
    "assessedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "collection_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "articlesCollected" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_sourceId_key" ON "news_articles"("sourceId");

-- CreateIndex
CREATE INDEX "news_articles_publishedAt_idx" ON "news_articles"("publishedAt");

-- CreateIndex
CREATE INDEX "news_articles_source_idx" ON "news_articles"("source");

-- CreateIndex
CREATE INDEX "economic_indicators_code_recordedAt_idx" ON "economic_indicators"("code", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "economic_indicators_code_recordedAt_key" ON "economic_indicators"("code", "recordedAt");

-- CreateIndex
CREATE INDEX "risk_assessments_category_assessedAt_idx" ON "risk_assessments"("category", "assessedAt");

-- CreateIndex
CREATE INDEX "collection_logs_startedAt_idx" ON "collection_logs"("startedAt");
