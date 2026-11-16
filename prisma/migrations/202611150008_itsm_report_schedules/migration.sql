CREATE TABLE "ItsmReportSchedule" (
  "id" SERIAL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "profileId" TEXT NOT NULL,
  "frequency" TEXT NOT NULL CHECK ("frequency" IN ('daily','weekly','monthly')),
  "hour" INTEGER NOT NULL CHECK ("hour" BETWEEN 0 AND 23),
  "minute" INTEGER NOT NULL CHECK ("minute" BETWEEN 0 AND 59),
  "day" INTEGER NOT NULL CHECK ("day" BETWEEN 1 AND 28),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("employeeId", "profileId")
);
CREATE INDEX "ItsmReportSchedule_due_idx" ON "ItsmReportSchedule" ("active", "nextRunAt");
CREATE TABLE "ItsmReportRun" (
  "id" SERIAL PRIMARY KEY,
  "scheduleId" INTEGER NOT NULL REFERENCES "ItsmReportSchedule"("id") ON DELETE CASCADE,
  "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "profileName" TEXT NOT NULL,
  "columns" JSONB NOT NULL,
  "tickets" JSONB NOT NULL,
  "readAt" TIMESTAMP(3),
  UNIQUE ("scheduleId", "dueAt")
);
CREATE INDEX "ItsmReportRun_employee_idx" ON "ItsmReportRun" ("employeeId", "createdAt" DESC);
