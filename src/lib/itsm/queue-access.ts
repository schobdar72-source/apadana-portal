import { Prisma } from "@prisma/client";

export function queueTicketAccess(employeeId: number, locationId: number | null) {
  return Prisma.sql`(t."status" = 'waiting_assignment' AND t."assigneeId" IS NULL AND t."locationId" = ${locationId} AND EXISTS (
    SELECT 1 FROM "ItsmGroupMembership" membership
    JOIN "ItsmGroup" service_group ON service_group."id" = membership."groupId" AND service_group."active" = true
    JOIN "ItsmRoleGrant" grant_role ON grant_role."employeeId" = membership."employeeId" AND grant_role."role" IN ('technician', 'group_head')
    WHERE membership."employeeId" = ${employeeId} AND membership."groupId" = t."groupId"
  ))`;
}
