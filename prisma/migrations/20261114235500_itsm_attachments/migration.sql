CREATE TABLE "ItsmAttachment" (
  "id" SERIAL PRIMARY KEY,
  "ticketId" INTEGER NOT NULL REFERENCES "ItsmTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "uploaderId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "filename" TEXT NOT NULL,
  "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 5242880),
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ItsmAttachment_ticketId_createdAt_idx" ON "ItsmAttachment"("ticketId", "createdAt");
