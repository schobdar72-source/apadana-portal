ALTER TABLE "ItsmTicket" ADD COLUMN "satisfaction" INTEGER, ADD COLUMN "satisfactionNote" TEXT NOT NULL DEFAULT '', ADD COLUMN "satisfiedAt" TIMESTAMP(3), ADD COLUMN "satisfiedById" INTEGER REFERENCES "Employee"("id") ON DELETE RESTRICT;
ALTER TABLE "ItsmTicket" ADD CONSTRAINT "ItsmTicket_satisfaction_check" CHECK ("satisfaction" IS NULL OR "satisfaction" BETWEEN 1 AND 5);
