import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  if (!auth.user.locationId) return NextResponse.json({ count: 0 }, { headers });
  const rows = await db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::integer AS "count" FROM "ItsmTicket" t JOIN "ItsmGroup" g ON g."id" = t."groupId" WHERE t."status" = 'waiting_assignment' AND t."assigneeId" IS NULL AND t."locationId" = ${auth.user.locationId} AND g."active" = true AND EXISTS (SELECT 1 FROM "ItsmGroupMembership" m JOIN "ItsmRoleGrant" r ON r."employeeId" = m."employeeId" AND r."role" IN ('technician', 'group_head') WHERE m."employeeId" = ${auth.user.id} AND m."groupId" = t."groupId")`;
  return NextResponse.json({ count: rows[0].count }, { headers });
}
