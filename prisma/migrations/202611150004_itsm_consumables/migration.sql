CREATE TABLE "ItsmConsumable" (
 "id" SERIAL PRIMARY KEY,
 "warehouseId" INTEGER NOT NULL REFERENCES "ItsmWarehouse"("id") ON DELETE RESTRICT,
 "name" TEXT NOT NULL, "code" TEXT NOT NULL UNIQUE, "unit" TEXT NOT NULL,
 "quantity" INTEGER NOT NULL DEFAULT 0 CHECK ("quantity">=0),
 "minimum" INTEGER NOT NULL DEFAULT 0 CHECK ("minimum">=0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ItsmConsumableEvent" (
 "id" SERIAL PRIMARY KEY,
 "itemId" INTEGER NOT NULL REFERENCES "ItsmConsumable"("id") ON DELETE RESTRICT,
 "actorId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
 "recipientId" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT,
 "action" TEXT NOT NULL CHECK ("action" IN ('created','receive','issue')),
 "quantity" INTEGER NOT NULL CHECK ("quantity">=0),
 "balance" INTEGER NOT NULL CHECK ("balance">=0), "note" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ItsmConsumable_warehouseId_idx" ON "ItsmConsumable" ("warehouseId");
CREATE INDEX "ItsmConsumableEvent_itemId_createdAt_idx" ON "ItsmConsumableEvent" ("itemId", "createdAt");
