CREATE TABLE "ItsmWarehouseCustodian" (
  "id" SERIAL PRIMARY KEY,
  "warehouseId" INTEGER NOT NULL REFERENCES "ItsmWarehouse"("id") ON DELETE RESTRICT,
  "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("warehouseId", "employeeId")
);
CREATE INDEX "ItsmWarehouseCustodian_employeeId_idx" ON "ItsmWarehouseCustodian" ("employeeId");
