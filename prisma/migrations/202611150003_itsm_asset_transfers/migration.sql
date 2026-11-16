CREATE TABLE "ItsmAssetTransfer" (
  "id" SERIAL PRIMARY KEY,
  "assetId" INTEGER NOT NULL REFERENCES "ItsmAsset"("id") ON DELETE RESTRICT,
  "sourceWarehouseId" INTEGER NOT NULL REFERENCES "ItsmWarehouse"("id") ON DELETE RESTRICT,
  "destinationWarehouseId" INTEGER NOT NULL REFERENCES "ItsmWarehouse"("id") ON DELETE RESTRICT,
  "requestedById" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "reason" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending','accepted','rejected','cancelled')),
  "decidedById" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CHECK ("sourceWarehouseId" <> "destinationWarehouseId")
);
CREATE UNIQUE INDEX "ItsmAssetTransfer_one_pending" ON "ItsmAssetTransfer" ("assetId") WHERE "state"='pending';
CREATE INDEX "ItsmAssetTransfer_destination_state_idx" ON "ItsmAssetTransfer" ("destinationWarehouseId","state");
