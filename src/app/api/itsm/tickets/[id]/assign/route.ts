import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const valid = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers });

function assignmentAccess(employeeId: number, locationId: number | null) {
  return Prisma.sql`(EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${employeeId} AND r."role" = 'it_manager') OR (t."locationId" = ${locationId} AND EXISTS (SELECT 1 FROM "ItsmRoleGrant" r JOIN "ItsmGroupMembership" m ON m."employeeId" = r."employeeId" JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true WHERE r."employeeId" = ${employeeId} AND r."role" = 'group_head' AND m."groupId" = t."groupId")))`;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id); if (!valid(id)) return fail("تیکت پیدا نشد.", 404);
  const tickets = await db.$queryRaw<{ id: number }[]>`SELECT t."id" FROM "ItsmTicket" t WHERE t."id" = ${id} AND t."status" = 'waiting_assignment' AND t."assigneeId" IS NULL AND ${assignmentAccess(auth.user.id, auth.user.locationId)}`;
  if (!tickets.length) return fail("امکان انتصاب این تیکت وجود ندارد.", 404);
  const people = await db.$queryRaw`SELECT DISTINCT e."id", e."firstName", e."lastName", e."code" FROM "ItsmTicket" t JOIN "ItsmGroup" g ON g."id" = t."groupId" AND g."active" = true JOIN "ItsmGroupMembership" m ON m."groupId" = g."id" JOIN "Employee" e ON e."id" = m."employeeId" AND e."active" = true AND e."locationId" = t."locationId" JOIN "ItsmRoleGrant" r ON r."employeeId" = e."id" AND r."role" IN ('technician', 'group_head') WHERE t."id" = ${id} AND t."status" = 'waiting_assignment' AND t."assigneeId" IS NULL AND ${assignmentAccess(auth.user.id, auth.user.locationId)} ORDER BY e."firstName", e."lastName", e."code"`;
  return NextResponse.json(people, { headers });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id); if (!valid(id)) return fail("تیکت پیدا نشد.", 404);
  let body: { employeeId?: unknown };
  try { body = await request.json(); } catch { return fail("کارشناس معتبر را انتخاب کنید.", 400); }
  if (!body || typeof body.employeeId !== "number" || !valid(body.employeeId)) return fail("کارشناس معتبر را انتخاب کنید.", 400);
  const employeeId = body.employeeId;
  const assigned = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{id:number}[]>`UPDATE "ItsmTicket" t SET "assigneeId" = ${employeeId}, "status" = 'in_progress', "updatedAt" = CURRENT_TIMESTAMP WHERE t."id" = ${id} AND t."status" = 'waiting_assignment' AND t."assigneeId" IS NULL AND ${assignmentAccess(auth.user.id, auth.user.locationId)} AND EXISTS (SELECT 1 FROM "ItsmGroupMembership" m JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true JOIN "Employee" e ON e."id" = m."employeeId" AND e."active" = true AND e."locationId" = t."locationId" JOIN "ItsmRoleGrant" r ON r."employeeId" = e."id" AND r."role" IN ('technician', 'group_head') WHERE m."employeeId" = ${employeeId} AND m."groupId" = t."groupId") RETURNING t."id"`;
    if (!rows.length) return false;
    await tx.$executeRaw`UPDATE "ItsmTransfer" SET "state" = 'accepted', "decidedById" = ${auth.user.id}, "decidedAt" = CURRENT_TIMESTAMP WHERE "ticketId" = ${id} AND "state" = 'pending'`;
    await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${id}, ${auth.user.id}, 'assigned')`;
    await tx.$executeRaw`INSERT INTO "ItsmAuditEvent" ("actorId", "action", "targetType", "targetId", "details") VALUES (${auth.user.id}, 'ticket_assigned', 'ticket', ${id}, ${JSON.stringify({ assigneeId: employeeId })}::jsonb)`;
    return true;
  });
  return assigned ? NextResponse.json({ ok: true }, { headers }) : fail("تیکت قبلاً برداشته شده یا کارشناس و دسترسی معتبر نیست.", 409);
}
