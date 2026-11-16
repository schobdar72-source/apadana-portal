CREATE TABLE "ItsmPersonalAsset" (
  "id" SERIAL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL,
  "locationId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "computerName" TEXT NOT NULL DEFAULT '',
  "cpu" TEXT NOT NULL DEFAULT '',
  "ram" TEXT NOT NULL DEFAULT '',
  "hdd" TEXT NOT NULL DEFAULT '',
  "ssd" TEXT NOT NULL DEFAULT '',
  "vga" TEXT NOT NULL DEFAULT '',
  "ip" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItsmPersonalAsset_employee_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT,
  CONSTRAINT "ItsmPersonalAsset_location_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT
);
CREATE INDEX "ItsmPersonalAsset_employeeId_locationId_active_idx" ON "ItsmPersonalAsset"("employeeId", "locationId", "active");
ALTER TABLE "ItsmTicket" ADD COLUMN "personalAssetId" INTEGER;
ALTER TABLE "ItsmTicket" ADD CONSTRAINT "ItsmTicket_personalAssetId_fkey" FOREIGN KEY ("personalAssetId") REFERENCES "ItsmPersonalAsset"("id") ON DELETE RESTRICT;
CREATE INDEX "ItsmTicket_personalAssetId_idx" ON "ItsmTicket"("personalAssetId");
