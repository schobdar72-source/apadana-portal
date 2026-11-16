CREATE TABLE "ItsmCategory" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "groupId" INTEGER NOT NULL REFERENCES "ItsmGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ItsmCategory_groupId_idx" ON "ItsmCategory"("groupId");

CREATE TABLE "ItsmTicket" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "categoryId" INTEGER NOT NULL REFERENCES "ItsmCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "groupId" INTEGER NOT NULL REFERENCES "ItsmGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requesterId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "beneficiaryId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'waiting_assignment',
  "locationId" INTEGER REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItsmTicket_status_check" CHECK ("status" IN ('waiting_assignment', 'in_progress', 'waiting_user', 'waiting_action', 'resolved', 'closed', 'cancelled'))
);
CREATE INDEX "ItsmTicket_requesterId_createdAt_idx" ON "ItsmTicket"("requesterId", "createdAt");
CREATE INDEX "ItsmTicket_beneficiaryId_createdAt_idx" ON "ItsmTicket"("beneficiaryId", "createdAt");
CREATE INDEX "ItsmTicket_groupId_status_idx" ON "ItsmTicket"("groupId", "status");

CREATE TABLE "ItsmTicketEvent" (
  "id" SERIAL PRIMARY KEY,
  "ticketId" INTEGER NOT NULL REFERENCES "ItsmTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ItsmTicketEvent_ticketId_createdAt_idx" ON "ItsmTicketEvent"("ticketId", "createdAt");
