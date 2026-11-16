CREATE TABLE "ItsmGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItsmGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItsmGroup_name_key" ON "ItsmGroup"("name");

CREATE TABLE "ItsmRoleGrant" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItsmRoleGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ItsmRoleGrant_role_check" CHECK ("role" IN ('technician', 'group_head', 'it_manager'))
);
CREATE UNIQUE INDEX "ItsmRoleGrant_employeeId_role_key" ON "ItsmRoleGrant"("employeeId", "role");
ALTER TABLE "ItsmRoleGrant" ADD CONSTRAINT "ItsmRoleGrant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ItsmGroupMembership" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItsmGroupMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItsmGroupMembership_employeeId_groupId_key" ON "ItsmGroupMembership"("employeeId", "groupId");
CREATE INDEX "ItsmGroupMembership_groupId_idx" ON "ItsmGroupMembership"("groupId");
ALTER TABLE "ItsmGroupMembership" ADD CONSTRAINT "ItsmGroupMembership_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItsmGroupMembership" ADD CONSTRAINT "ItsmGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItsmGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ItsmAuditEvent" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItsmAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ItsmAuditEvent_actorId_createdAt_idx" ON "ItsmAuditEvent"("actorId", "createdAt");
CREATE INDEX "ItsmAuditEvent_targetType_targetId_idx" ON "ItsmAuditEvent"("targetType", "targetId");
