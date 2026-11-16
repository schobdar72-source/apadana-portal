CREATE TABLE "ItsmAssetCategory" (
  "id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE,
  "parentId" INTEGER REFERENCES "ItsmAssetCategory"("id") ON DELETE RESTRICT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE "ItsmWarehouse" (
  "id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL,
  "groupId" INTEGER NOT NULL REFERENCES "ItsmGroup"("id") ON DELETE RESTRICT,
  "locationId" INTEGER NOT NULL REFERENCES "Location"("id") ON DELETE RESTRICT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE ("groupId", "locationId")
);
CREATE TABLE "ItsmAsset" (
  "id" SERIAL PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
  "categoryId" INTEGER NOT NULL REFERENCES "ItsmAssetCategory"("id") ON DELETE RESTRICT,
  "warehouseId" INTEGER NOT NULL REFERENCES "ItsmWarehouse"("id") ON DELETE RESTRICT,
  "serial" TEXT NOT NULL DEFAULT '', "brand" TEXT NOT NULL DEFAULT '', "model" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'available' CHECK ("status" IN ('available','assigned','broken','repair','quarantine','scrapped')),
  "assignedToId" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("status" = 'assigned') = ("assignedToId" IS NOT NULL))
);
CREATE TABLE "ItsmAssetEvent" (
  "id" SERIAL PRIMARY KEY, "assetId" INTEGER NOT NULL REFERENCES "ItsmAsset"("id") ON DELETE RESTRICT,
  "actorId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "recipientId" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "action" TEXT NOT NULL, "note" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ItsmAsset_assignedToId_idx" ON "ItsmAsset" ("assignedToId");
CREATE INDEX "ItsmAssetEvent_assetId_createdAt_idx" ON "ItsmAssetEvent" ("assetId", "createdAt");
