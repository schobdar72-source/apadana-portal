import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { transitionSla, txNow } from "@/lib/itsm/sla-runtime";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: "ارجاع پیدا نشد." }, { status: 404 });
  let data: { decision?: unknown; reason?: unknown };
  try { data = await request.json(); } catch { return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400 }); }
  const decision = data?.decision, reason = typeof data?.reason === "string" ? data.reason.trim() : "";
  if ((decision !== "accept" && decision !== "reject") || (decision === "reject" && (!reason || reason.length > 500))) return NextResponse.json({ error: "تصمیم و دلیل رد را مشخص کنید." }, { status: 400 });
  const done = await db.$transaction(async (tx) => {
    const references = await tx.$queryRaw<{ ticketId: number }[]>`SELECT "ticketId" FROM "ItsmTransfer" WHERE "id" = ${id}`;
    if (!references.length) return false;
    const ticketId = references[0].ticketId;
    const tickets = await tx.$queryRaw<{ id: number; groupId: number; locationId: number | null; status: string; assigneeId: number | null }[]>`SELECT "id", "groupId", "locationId", "status", "assigneeId" FROM "ItsmTicket" WHERE "id" = ${ticketId} FOR UPDATE`;
    const transfers = await tx.$queryRaw<{ state: string; destinationGroupId: number; sourceGroupId: number; previousAssigneeId: number | null; previousStatus: string }[]>`SELECT "state", "destinationGroupId", "sourceGroupId", "previousAssigneeId", "previousStatus" FROM "ItsmTransfer" WHERE "id" = ${id} FOR UPDATE`;
    const ticket = tickets[0], transfer = transfers[0];
    if (!ticket || !transfer || transfer.state !== "pending" || ticket.groupId !== transfer.destinationGroupId || ticket.status !== "waiting_assignment" || ticket.assigneeId !== null) return false;
    const access = await tx.$queryRaw<{ allowed: boolean }[]>`SELECT (EXISTS (SELECT 1 FROM "ItsmRoleGrant" WHERE "employeeId" = ${auth.user.id} AND "role" = 'it_manager') OR (${auth.user.locationId}::integer IS NOT NULL AND "location"."id" = ${auth.user.locationId} AND EXISTS (SELECT 1 FROM "ItsmRoleGrant" r JOIN "ItsmGroupMembership" m ON m."employeeId" = r."employeeId" JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'group_head' AND m."groupId" = ${transfer.destinationGroupId}))) AS "allowed" FROM "Location" "location" WHERE "location"."id" = ${ticket.locationId}`;
    if (!access[0]?.allowed) return false;
    if (decision === "reject") {
      const eligible = transfer.previousAssigneeId ? await tx.$queryRaw<{ id: number }[]>`SELECT e."id" FROM "Employee" e JOIN "ItsmRoleGrant" r ON r."employeeId" = e."id" AND r."role" IN ('technician', 'group_head') JOIN "ItsmGroupMembership" m ON m."employeeId" = e."id" AND m."groupId" = ${transfer.sourceGroupId} JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true WHERE e."id" = ${transfer.previousAssigneeId} AND e."active" = true AND e."locationId" = ${ticket.locationId} LIMIT 1` : [];
      const previous = eligible[0]?.id ?? null;
      await tx.$executeRaw`UPDATE "ItsmTicket" SET "groupId" = ${transfer.sourceGroupId}, "assigneeId" = ${previous}, "status" = ${previous ? transfer.previousStatus : "waiting_assignment"}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${ticketId}`;
      if (previous && transfer.previousStatus === 'waiting_user') await transitionSla(tx, ticketId, auth.user.id, await txNow(tx), 'pause');
    }
    await tx.$executeRaw`UPDATE "ItsmTransfer" SET "state" = ${decision === "reject" ? "rejected" : "accepted"}, "decidedById" = ${auth.user.id}, "decisionReason" = ${decision === "reject" ? reason : null}, "decidedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}`;
    await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${ticketId}, ${auth.user.id}, ${decision === "reject" ? "transfer_rejected" : "transfer_accepted"})`;
    return true;
  });
  return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ارجاع قابل تصمیم‌گیری نیست یا قبلاً بررسی شده است." }, { status: 409 });
}
