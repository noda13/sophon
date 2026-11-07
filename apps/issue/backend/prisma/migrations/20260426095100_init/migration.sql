-- CreateTable
CREATE TABLE "issues" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "rawContent" TEXT NOT NULL DEFAULT '',
    "summaryJa" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "severityScore" INTEGER NOT NULL DEFAULT 0,
    "urgencyScore" INTEGER NOT NULL DEFAULT 0,
    "appifiabilityScore" INTEGER NOT NULL DEFAULT 0,
    "affectedDomain" TEXT NOT NULL DEFAULT '[]',
    "classifiedAt" DATETIME,
    "proposedAppIdea" TEXT NOT NULL DEFAULT '',
    "mvpFeatures" TEXT NOT NULL DEFAULT '[]',
    "targetUsers" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT '',
    "ideaGeneratedAt" DATETIME,
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
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "issues_sourceId_key" ON "issues"("sourceId");

-- CreateIndex
CREATE INDEX "issues_publishedAt_idx" ON "issues"("publishedAt");

-- CreateIndex
CREATE INDEX "issues_category_idx" ON "issues"("category");

-- CreateIndex
CREATE INDEX "issues_appifiabilityScore_idx" ON "issues"("appifiabilityScore");

-- CreateIndex
CREATE INDEX "collection_logs_startedAt_idx" ON "collection_logs"("startedAt");
