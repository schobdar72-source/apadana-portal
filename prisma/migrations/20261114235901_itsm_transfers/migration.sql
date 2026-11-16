CREATE TABLE "ItsmTransfer" (
  "id" SERIAL PRIMARY KEY,
  "ticketId" INTEGER NOT NULL REFERENCES "ItsmTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sourceGroupId" INTEGER NOT NULL REFERENCES "ItsmGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "destinationGroupId" INTEGER NOT NULL REFERENCES "ItsmGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "previousAssigneeId" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "previousStatus" TEXT NOT NULL,
  "requestedById" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "state" TEXT NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending', 'accepted', 'rejected')),
  "decidedById" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3)
);
CREATE INDEX "ItsmTransfer_destinationGroupId_state_idx" ON "ItsmTransfer"("destinationGroupId", "state");
CREATE INDEX "ItsmTransfer_ticketId_createdAt_idx" ON "ItsmTransfer"("ticketId", "createdAt");
CREATE UNIQUE INDEX "ItsmTransfer_one_pending_per_ticket" ON "ItsmTransfer"("ticketId") WHERE "state" = 'pending';
