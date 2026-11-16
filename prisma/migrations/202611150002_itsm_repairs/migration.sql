CREATE TABLE "ItsmAssetRepair" (
  "id" SERIAL PRIMARY KEY,
  "assetId" INTEGER NOT NULL REFERENCES "ItsmAsset"("id") ON DELETE RESTRICT,
  "reportedById" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "report" TEXT NOT NULL,
  "outcome" TEXT NOT NULL CHECK ("outcome" IN ('available','scrapped')),
  "state" TEXT NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending','approved','rejected')),
  "decidedById" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "ItsmAssetRepair_one_pending" ON "ItsmAssetRepair" ("assetId") WHERE "state"='pending';
CREATE INDEX "ItsmAssetRepair_assetId_createdAt_idx" ON "ItsmAssetRepair" ("assetId", "createdAt");
