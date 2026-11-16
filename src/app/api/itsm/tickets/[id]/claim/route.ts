import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647 || !auth.user.locationId) return NextResponse.json({ error: "درخواست در دسترس نیست." }, { status: 404 });
  const claimed = await db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<{ id: number }[]>`UPDATE "ItsmTicket" t SET "assigneeId" = ${auth.user.id}, "status" = 'in_progress', "updatedAt" = CURRENT_TIMESTAMP WHERE t."id" = ${id} AND t."status" = 'waiting_assignment' AND t."assigneeId" IS NULL AND t."locationId" = ${auth.user.locationId} AND EXISTS (SELECT 1 FROM "ItsmGroupMembership" m JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true JOIN "ItsmRoleGrant" r ON r."employeeId" = m."employeeId" AND r."role" IN ('technician', 'group_head') WHERE m."employeeId" = ${auth.user.id} AND m."groupId" = t."groupId") RETURNING t."id"`;
    if (!rows.length) return false;
    await transaction.$executeRaw`UPDATE "ItsmTransfer" SET "state" = 'accepted', "decidedById" = ${auth.user.id}, "decidedAt" = CURRENT_TIMESTAMP WHERE "ticketId" = ${id} AND "state" = 'pending'`;
    await transaction.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${id}, ${auth.user.id}, 'claimed')`;
    return true;
  });
  return claimed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "تیکت در دسترس شما نیست یا قبلاً برداشته شده است." }, { status: 409 });
}
