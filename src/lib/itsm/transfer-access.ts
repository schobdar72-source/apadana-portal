import { Prisma } from "@prisma/client";

export function incomingTransferAccess(employeeId: number, locationId: number | null) {
  return Prisma.sql`(EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${employeeId} AND r."role" = 'it_manager') OR (t."locationId" = ${locationId} AND EXISTS (SELECT 1 FROM "ItsmRoleGrant" r JOIN "ItsmGroupMembership" m ON m."employeeId" = r."employeeId" JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true WHERE r."employeeId" = ${employeeId} AND r."role" = 'group_head' AND m."groupId" = x."destinationGroupId")))`;
}
