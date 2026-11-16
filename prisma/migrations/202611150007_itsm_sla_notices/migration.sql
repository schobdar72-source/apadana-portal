CREATE TABLE "ItsmSlaNotice" (
 "id" SERIAL PRIMARY KEY,
 "slaId" INTEGER NOT NULL REFERENCES "ItsmTicketSla"("id") ON DELETE RESTRICT,
 "ticketId" INTEGER NOT NULL REFERENCES "ItsmTicket"("id") ON DELETE RESTRICT,
 "recipientId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
 "metric" TEXT NOT NULL CHECK ("metric" IN ('response','resolution')),
 "kind" TEXT NOT NULL CHECK ("kind" IN ('warning','breach')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "readAt" TIMESTAMP(3),
 UNIQUE ("slaId","recipientId","metric","kind")
);
CREATE INDEX "ItsmSlaNotice_recipientId_readAt_idx" ON "ItsmSlaNotice" ("recipientId","readAt");
