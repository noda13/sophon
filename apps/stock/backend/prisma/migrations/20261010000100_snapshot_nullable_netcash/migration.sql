-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_screening_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "snapshotAt" DATETIME NOT NULL,
    "marketCap" REAL NOT NULL,
    "netCash" REAL,
    "netCashRatio" REAL,
    "cashNeutralPer" REAL,
    "per" REAL,
    "pbr" REAL,
    CONSTRAINT "screening_snapshots_code_fkey" FOREIGN KEY ("code") REFERENCES "stocks" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_screening_snapshots" ("cashNeutralPer", "code", "id", "marketCap", "netCash", "netCashRatio", "pbr", "per", "snapshotAt") SELECT "cashNeutralPer", "code", "id", "marketCap", "netCash", "netCashRatio", "pbr", "per", "snapshotAt" FROM "screening_snapshots";
DROP TABLE "screening_snapshots";
ALTER TABLE "new_screening_snapshots" RENAME TO "screening_snapshots";
CREATE INDEX "screening_snapshots_code_snapshotAt_idx" ON "screening_snapshots"("code", "snapshotAt");
CREATE INDEX "screening_snapshots_snapshotAt_netCashRatio_idx" ON "screening_snapshots"("snapshotAt", "netCashRatio");
CREATE INDEX "screening_snapshots_snapshotAt_cashNeutralPer_idx" ON "screening_snapshots"("snapshotAt", "cashNeutralPer");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

