ALTER TABLE "ItsmAssetRepair" ADD COLUMN "ticketId" INTEGER REFERENCES "ItsmTicket"("id") ON DELETE RESTRICT;
CREATE INDEX "ItsmAssetRepair_ticketId_idx" ON "ItsmAssetRepair" ("ticketId");
