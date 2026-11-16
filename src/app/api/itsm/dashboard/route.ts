import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { transferIndicator } from "@/lib/itsm/transfer-indicator";
import { latestSlaJoin, latestSlaSelect, withSlaBadge } from "@/lib/itsm/sla-list";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const filters: Record<string, string[]> = {
  all: [], active: ["waiting_assignment", "in_progress"], waiting: ["waiting_user", "waiting_action"], done: ["resolved", "closed"], cancelled: ["cancelled"],
};

export async function GET(request: Request) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") || "all", filter = params.get("status") || "all", query = (params.get("q") || "").trim();
  const page = Number(params.get("page") || "1");
  if (!['all', 'requested', 'assigned'].includes(scope) || !Object.hasOwn(filters, filter) || query.length > 100 || !Number.isSafeInteger(page) || page < 1 || page > 1000000) return NextResponse.json({ error: "فیلتر معتبر نیست." }, { status: 400, headers });
  const employeeId = auth.user.id;
  const access = scope === 'requested' ? Prisma.sql`(t."requesterId" = ${employeeId} OR t."beneficiaryId" = ${employeeId})` : scope === 'assigned' ? Prisma.sql`t."assigneeId" = ${employeeId}` : Prisma.sql`(t."requesterId" = ${employeeId} OR t."beneficiaryId" = ${employeeId} OR t."assigneeId" = ${employeeId})`;
  const selection = filters[filter].length ? Prisma.sql`AND t."status" = ANY(${filters[filter]}::text[])` : Prisma.empty;
  const pattern = `%${query}%`;
  const search = query ? Prisma.sql`AND (t."title" ILIKE ${pattern} OR t."id"::text ILIKE ${pattern} OR c."name" ILIKE ${pattern} OR g."name" ILIKE ${pattern} OR concat_ws(' ', requester."firstName", requester."lastName") ILIKE ${pattern} OR concat_ws(' ', beneficiary."firstName", beneficiary."lastName") ILIKE ${pattern})` : Prisma.empty;
  const base = Prisma.sql`FROM "ItsmTicket" t JOIN "ItsmCategory" c ON c."id" = t."categoryId" JOIN "ItsmGroup" g ON g."id" = t."groupId" JOIN "Employee" requester ON requester."id" = t."requesterId" JOIN "Employee" beneficiary ON beneficiary."id" = t."beneficiaryId"`;
  const [counts, matches, tickets] = await Promise.all([
    db.$queryRaw<{ total: number; active: number; waiting: number; done: number; cancelled: number }[]>`SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE t."status" IN ('waiting_assignment', 'in_progress'))::int AS "active", COUNT(*) FILTER (WHERE t."status" IN ('waiting_user', 'waiting_action'))::int AS "waiting", COUNT(*) FILTER (WHERE t."status" IN ('resolved', 'closed'))::int AS "done", COUNT(*) FILTER (WHERE t."status" = 'cancelled')::int AS "cancelled" ${base} WHERE ${access}`,
    db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS "count" ${base} WHERE ${access} ${selection} ${search}`,
    db.$queryRaw`SELECT t."id", t."title", t."status", t."createdAt", t."updatedAt", t."assigneeId" = ${employeeId} AS "isAssignee", (t."requesterId" = ${employeeId} OR t."beneficiaryId" = ${employeeId}) AS "isParticipant", c."name" AS "category", g."name" AS "group", requester."firstName" || ' ' || requester."lastName" AS "requesterName", beneficiary."firstName" || ' ' || beneficiary."lastName" AS "beneficiaryName", (t."requesterId" <> t."beneficiaryId") AS "isForOther", assignee."firstName" || ' ' || assignee."lastName" AS "assigneeName", COALESCE(personal."name", asset."name") AS "assetName", COALESCE(personal."computerName", asset."code") AS "assetCode", transfer_info."sourceGroup" AS "transferSource", transfer_info."senderName" AS "transferSender", COALESCE(t."assigneeId" = ${employeeId} AND (SELECT e."action" = 'assigned' AND e."actorId" <> ${employeeId} FROM "ItsmTicketEvent" e WHERE e."ticketId" = t."id" AND e."action" IN ('assigned', 'claimed', 'transferred') ORDER BY e."id" DESC LIMIT 1), false) AS "assignedBySupervisor", ${latestSlaSelect} ${base} LEFT JOIN "Employee" assignee ON assignee."id" = t."assigneeId" LEFT JOIN "ItsmAsset" asset ON asset."id" = t."assetId" LEFT JOIN "ItsmPersonalAsset" personal ON personal."id" = t."personalAssetId" ${transferIndicator(Prisma.sql`t."assigneeId" = ${employeeId}`)} ${latestSlaJoin} WHERE ${access} ${selection} ${search} ORDER BY t."createdAt" DESC, t."id" DESC LIMIT 15 OFFSET ${(page - 1) * 15}`,
  ]);
  const now = new Date();
  const ticketList = (tickets as Parameters<typeof withSlaBadge>[0][]).map((row) => withSlaBadge(row, now));
  return NextResponse.json({ counts: counts[0], total: matches[0].count, page, pageSize: 15, tickets: ticketList }, { headers });
}
