import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { queueTicketAccess } from "@/lib/itsm/queue-access";
import { transferIndicator } from "@/lib/itsm/transfer-indicator";
import { latestSlaJoin, latestSlaSelect, slaPriorityOrder, withSlaBadge } from "@/lib/itsm/sla-list";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  if (!auth.user.locationId) return NextResponse.json([], { headers });
  const rows = await db.$queryRaw`SELECT t."id", t."title", t."status", t."createdAt", c."name" AS "category", g."name" AS "group", requester."firstName" || ' ' || requester."lastName" AS "requesterName", beneficiary."firstName" || ' ' || beneficiary."lastName" AS "beneficiaryName", (t."requesterId" <> t."beneficiaryId") AS "isForOther", unit."name" AS "requesterUnit", beneficiary_unit."name" AS "beneficiaryUnit", transfer_info."sourceGroup" AS "transferSource", transfer_info."senderName" AS "transferSender", ${latestSlaSelect} FROM "ItsmTicket" t JOIN "ItsmCategory" c ON c."id" = t."categoryId" JOIN "ItsmGroup" g ON g."id" = t."groupId" JOIN "Employee" requester ON requester."id" = t."requesterId" JOIN "Employee" beneficiary ON beneficiary."id" = t."beneficiaryId" LEFT JOIN "OrgUnit" unit ON unit."id" = requester."unitId" LEFT JOIN "OrgUnit" beneficiary_unit ON beneficiary_unit."id" = beneficiary."unitId" ${transferIndicator(Prisma.sql`true`)} ${latestSlaJoin} WHERE ${queueTicketAccess(auth.user.id, auth.user.locationId)} ORDER BY ${slaPriorityOrder}, t."createdAt", t."id" LIMIT 100`;
  const now = new Date();
  return NextResponse.json((rows as Parameters<typeof withSlaBadge>[0][]).map((row) => withSlaBadge(row, now)), { headers });
}
