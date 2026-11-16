CREATE TABLE "ItsmSlaPolicyVersion" (
  "id" SERIAL PRIMARY KEY,
  "policy" JSONB NOT NULL,
  "createdById" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ItsmSlaPolicyVersion_createdAt_id_idx" ON "ItsmSlaPolicyVersion"("createdAt", "id");
