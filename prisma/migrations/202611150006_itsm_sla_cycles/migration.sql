CREATE TABLE "ItsmTicketSla" (
 "id" SERIAL PRIMARY KEY, "ticketId" INTEGER NOT NULL REFERENCES "ItsmTicket"("id") ON DELETE RESTRICT,
 "policyVersionId" INTEGER REFERENCES "ItsmSlaPolicyVersion"("id") ON DELETE RESTRICT,
 "policy" JSONB NOT NULL, "priority" TEXT NOT NULL CHECK ("priority" IN ('critical','high','normal','low')),
 "state" TEXT NOT NULL CHECK ("state" IN ('running','paused','resolved','cancelled','superseded')),
 "startedAt" TIMESTAMP(3) NOT NULL, "segmentStartedAt" TIMESTAMP(3), "elapsedMs" BIGINT NOT NULL DEFAULT 0 CHECK ("elapsedMs">=0),
 "responseAt" TIMESTAMP(3), "responseElapsedMs" BIGINT, "endedAt" TIMESTAMP(3),
 "createdById" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
 "reason" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "ItsmTicketSla_one_current" ON "ItsmTicketSla" ("ticketId") WHERE "state" IN ('running','paused');
CREATE INDEX "ItsmTicketSla_ticketId_startedAt_idx" ON "ItsmTicketSla" ("ticketId","startedAt");
