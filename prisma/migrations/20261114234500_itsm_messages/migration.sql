ALTER TABLE "ItsmRoleGrant" DROP CONSTRAINT "ItsmRoleGrant_role_check";
ALTER TABLE "ItsmRoleGrant" ADD CONSTRAINT "ItsmRoleGrant_role_check" CHECK ("role" IN ('technician', 'group_head', 'it_manager', 'delegate'));
CREATE TABLE "ItsmMessage" (
  "id" SERIAL PRIMARY KEY,
  "ticketId" INTEGER NOT NULL REFERENCES "ItsmTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "authorId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ItsmMessage_ticketId_createdAt_idx" ON "ItsmMessage"("ticketId", "createdAt");
