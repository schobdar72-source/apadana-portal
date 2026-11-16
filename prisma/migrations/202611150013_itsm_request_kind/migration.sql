ALTER TABLE "ItsmTicket" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'incident';
ALTER TABLE "ItsmTicket" ADD CONSTRAINT "ItsmTicket_kind_check" CHECK ("kind" IN ('incident', 'service'));
