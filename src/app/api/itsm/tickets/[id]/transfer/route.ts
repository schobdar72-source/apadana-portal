import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { transitionSla, txNow } from "@/lib/itsm/sla-runtime";

const validId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0 && id <= 2147483647;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!validId(id)) return NextResponse.json({ error: "تیکت پیدا نشد." }, { status: 404 });
  const tickets = await db.$queryRaw<{ locationId: number | null }[]>`SELECT t."locationId" FROM "ItsmTicket" t WHERE t."id" = ${id} AND t."assigneeId" = ${auth.user.id} AND t."locationId" = ${auth.user.locationId} AND t."status" IN ('in_progress', 'waiting_user', 'waiting_action') AND EXISTS (SELECT 1 FROM "ItsmGroupMembership" m JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" JOIN "ItsmRoleGrant" r ON r."employeeId" = m."employeeId" AND r."role" IN ('technician', 'group_head') WHERE m."employeeId" = ${auth.user.id} AND m."groupId" = t."groupId")`;
  if (!tickets.length) return NextResponse.json({ error: "امکان ارجاع این تیکت وجود ندارد." }, { status: 404 });
  const [groups, people] = await Promise.all([
    db.$queryRaw`SELECT "id", "name" FROM "ItsmGroup" WHERE "active" = true ORDER BY "name"`,
    db.$queryRaw`SELECT DISTINCT e."id", e."firstName", e."lastName", e."code", e."positionTitle", g."id" AS "groupId", g."name" AS "groupName" FROM "Employee" e JOIN "ItsmGroupMembership" m ON m."employeeId" = e."id" JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true JOIN "ItsmRoleGrant" r ON r."employeeId" = e."id" AND r."role" IN ('technician', 'group_head') WHERE e."active" = true AND e."locationId" = ${tickets[0].locationId} AND e."id" <> ${auth.user.id} ORDER BY e."firstName", e."lastName", g."name"`,
  ]);
  return NextResponse.json({ groups, people }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: "تیکت پیدا نشد." }, { status: 404 });
  let data: { destinationGroupId?: unknown; destinationEmployeeId?: unknown; reason?: unknown };
  try { data = await request.json(); } catch { return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400 }); }
  const reason = typeof data?.reason === "string" ? data.reason.trim() : "";
  if (!data || !validId(data.destinationGroupId) || (data.destinationEmployeeId != null && !validId(data.destinationEmployeeId)) || reason.length < 6 || reason.length > 500 || reason.split(/\s+/).length < 2) return NextResponse.json({ error: "واحد مقصد و دلیل ارجاع را در حداقل دو کلمه وارد کنید." }, { status: 400 });
  const destinationId = data.destinationGroupId, destinationEmployeeId = data.destinationEmployeeId ?? null;
  const result = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ groupId: number; assigneeId: number | null; locationId: number | null; status: string }[]>`SELECT "groupId", "assigneeId", "locationId", "status" FROM "ItsmTicket" WHERE "id" = ${id} FOR UPDATE`;
    const ticket = rows[0];
    if (!ticket || ["closed", "cancelled", "resolved"].includes(ticket.status) || (ticket.groupId === destinationId && !destinationEmployeeId) || destinationEmployeeId === auth.user.id) return false;
    const access = await tx.$queryRaw<{ manager: boolean; head: boolean; technician: boolean }[]>`SELECT EXISTS (SELECT 1 FROM "ItsmRoleGrant" WHERE "employeeId" = ${auth.user.id} AND "role" = 'it_manager') AS "manager", EXISTS (SELECT 1 FROM "ItsmRoleGrant" r JOIN "ItsmGroupMembership" m ON m."employeeId" = r."employeeId" JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'group_head' AND m."groupId" = ${ticket.groupId}) AS "head", EXISTS (SELECT 1 FROM "ItsmRoleGrant" r JOIN "ItsmGroupMembership" m ON m."employeeId" = r."employeeId" JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true WHERE r."employeeId" = ${auth.user.id} AND r."role" IN ('technician', 'group_head') AND m."groupId" = ${ticket.groupId}) AS "technician"`;
    const permitted = access[0].manager || (auth.user.locationId !== null && auth.user.locationId === ticket.locationId && (access[0].head || (access[0].technician && ticket.assigneeId === auth.user.id)));
    if (!permitted) return false;
    const existing = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmTransfer" WHERE "ticketId" = ${id} AND "state" = 'pending'`;
    const destination = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmGroup" WHERE "id" = ${destinationId} AND "active" = true`;
    if (existing.length || !destination.length) return false;
    if (destinationEmployeeId) {
      const eligible = await tx.$queryRaw<{ id: number }[]>`SELECT e."id" FROM "Employee" e JOIN "ItsmGroupMembership" m ON m."employeeId" = e."id" AND m."groupId" = ${destinationId} JOIN "ItsmRoleGrant" r ON r."employeeId" = e."id" AND r."role" IN ('technician', 'group_head') WHERE e."id" = ${destinationEmployeeId} AND e."active" = true AND e."locationId" = ${ticket.locationId} LIMIT 1`;
      if (!eligible.length) return false;
    }
    await tx.$executeRaw`INSERT INTO "ItsmTransfer" ("ticketId", "sourceGroupId", "destinationGroupId", "previousAssigneeId", "previousStatus", "requestedById", "reason", "note", "state", "decidedAt") VALUES (${id}, ${ticket.groupId}, ${destinationId}, ${ticket.assigneeId}, ${ticket.status}, ${auth.user.id}, ${reason}, '', ${destinationEmployeeId ? 'accepted' : 'pending'}, ${destinationEmployeeId ? new Date() : null})`;
    await tx.$executeRaw`UPDATE "ItsmTicket" SET "groupId" = ${destinationId}, "assigneeId" = ${destinationEmployeeId}, "status" = ${destinationEmployeeId ? 'in_progress' : 'waiting_assignment'}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}`;
    if (ticket.status === 'waiting_user') await transitionSla(tx, id, auth.user.id, await txNow(tx), 'resume');
    await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${id}, ${auth.user.id}, 'transferred')`;
    await tx.$executeRaw`INSERT INTO "ItsmAuditEvent" ("actorId", "action", "targetType", "targetId", "details") VALUES (${auth.user.id}, 'ticket_transferred', 'ticket', ${id}, ${JSON.stringify({ sourceGroupId: ticket.groupId, destinationGroupId: destinationId, destinationEmployeeId })}::jsonb)`;
    return true;
  });
  return result ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ارجاع مجاز نیست، واحد مقصد معتبر نیست یا ارجاع دیگری در حال بررسی است." }, { status: 409 });
}
