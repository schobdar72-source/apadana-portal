ALTER TABLE "ItsmTicket" ADD COLUMN "assetId" INTEGER;
CREATE INDEX "ItsmTicket_assetId_idx" ON "ItsmTicket"("assetId");
ALTER TABLE "ItsmTicket" ADD CONSTRAINT "ItsmTicket_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ItsmAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
