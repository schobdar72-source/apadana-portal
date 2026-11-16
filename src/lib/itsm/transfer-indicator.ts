import { Prisma } from "@prisma/client";

export function transferIndicator(allowed: Prisma.Sql) {
  return Prisma.sql`LEFT JOIN LATERAL (
    SELECT transfer."state", transfer."destinationGroupId", transfer."reason", transfer."note", source."name" AS "sourceGroup", sender."firstName" || ' ' || sender."lastName" AS "senderName"
    FROM "ItsmTransfer" transfer
    JOIN "ItsmGroup" source ON source."id" = transfer."sourceGroupId"
    JOIN "Employee" sender ON sender."id" = transfer."requestedById"
    WHERE transfer."ticketId" = t."id"
    ORDER BY transfer."id" DESC LIMIT 1
  ) transfer_info ON transfer_info."state" IN ('pending', 'accepted') AND transfer_info."destinationGroupId" = t."groupId" AND (${allowed})`;
}
