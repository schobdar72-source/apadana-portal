ALTER TABLE "ItsmTicket" ADD COLUMN "assigneeId" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ItsmTicket_assigneeId_status_idx" ON "ItsmTicket"("assigneeId", "status");
