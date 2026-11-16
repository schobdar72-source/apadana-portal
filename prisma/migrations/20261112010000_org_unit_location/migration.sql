ALTER TABLE "OrgUnit" ADD COLUMN "locationId" INTEGER;
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OrgUnit_locationId_idx" ON "OrgUnit"("locationId");
