import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { transferIndicator } from "@/lib/itsm/transfer-indicator";
import { latestSlaJoin, latestSlaSelect, slaBadgeOf } from "@/lib/itsm/sla-list";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: "درخواست یافت نشد." }, { status: 404 });
  const rows = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT t."id", t."groupId", t."assetId", t."personalAssetId", assignee."firstName" || ' ' || assignee."lastName" AS "assigneeName", COALESCE(personal."name", asset."name") AS "assetName", COALESCE(personal."computerName", asset."code") AS "assetCode", personal."computerName" AS "assetComputerName", personal."cpu" AS "assetCpu", personal."ram" AS "assetRam", personal."hdd" AS "assetHdd", personal."ssd" AS "assetSsd", personal."vga" AS "assetVga", personal."ip" AS "assetIp", personal."notes" AS "assetNotes", asset."serial" AS "assetSerial", asset."brand" AS "assetBrand", asset."model" AS "assetModel", t."kind", t."title", t."description", t."contactExtension", t."status", t."createdAt", (t."assigneeId" = ${auth.user.id}) AS "isAssignee", COALESCE(t."assigneeId" = ${auth.user.id} AND (SELECT e."action" = 'assigned' AND e."actorId" <> ${auth.user.id} FROM "ItsmTicketEvent" e WHERE e."ticketId" = t."id" AND e."action" IN ('assigned', 'claimed', 'transferred') ORDER BY e."id" DESC LIMIT 1), false) AS "assignedBySupervisor", (t."requesterId" = ${auth.user.id} OR t."beneficiaryId" = ${auth.user.id}) AS "isParticipant", c."name" AS "category", g."name" AS "group", requester."firstName" || ' ' || requester."lastName" AS "requesterName", beneficiary."firstName" || ' ' || beneficiary."lastName" AS "beneficiaryName", (t."requesterId" <> t."beneficiaryId") AS "isForOther", unit."name" AS "requesterUnit", beneficiary_unit."name" AS "beneficiaryUnit", ${queueTicketAccess(auth.user.id, auth.user.locationId)} AS "isQueueViewer", transfer_info."sourceGroup" AS "transferSource", transfer_info."senderName" AS "transferSender", transfer_info."reason" AS "transferReason", transfer_info."note" AS "transferNote", ${latestSlaSelect}
    FROM "ItsmTicket" t JOIN "ItsmCategory" c ON c."id" = t."categoryId"
    LEFT JOIN "Employee" assignee ON assignee."id" = t."assigneeId" LEFT JOIN "ItsmAsset" asset ON asset."id" = t."assetId" LEFT JOIN "ItsmPersonalAsset" personal ON personal."id" = t."personalAssetId" JOIN "ItsmGroup" g ON g."id" = t."groupId" JOIN "Employee" requester ON requester."id" = t."requesterId" JOIN "Employee" beneficiary ON beneficiary."id" = t."beneficiaryId" LEFT JOIN "OrgUnit" unit ON unit."id" = requester."unitId" LEFT JOIN "OrgUnit" beneficiary_unit ON beneficiary_unit."id" = beneficiary."unitId"
    ${transferIndicator(Prisma.sql`(${queueTicketAccess(auth.user.id, auth.user.locationId)} OR t."assigneeId" = ${auth.user.id})`)}
    ${latestSlaJoin}
    WHERE t."id" = ${id} AND (t."requesterId" = ${auth.user.id} OR t."beneficiaryId" = ${auth.user.id} OR t."assigneeId" = ${auth.user.id} OR ${queueTicketAccess(auth.user.id, auth.user.locationId)} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'it_manager'))
  `;
  if (!rows.length) return NextResponse.json({ error: "درخواست یافت نشد." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const row = rows[0] as Record<string, unknown>;
  const badge = slaBadgeOf(row as Parameters<typeof slaBadgeOf>[0], new Date());
  ["slaPolicy", "slaStartedAt", "slaSegmentStartedAt", "slaElapsedMs", "slaResponseAt", "slaResponseElapsedMs", "slaEndedAt", "slaState"].forEach((key) => { delete row[key]; });
  return NextResponse.json({ ...row, priority: badge.priority, sla: badge.sla }, { headers: { "Cache-Control": "private, no-store" } });
}
import { queueTicketAccess } from "@/lib/itsm/queue-access";
