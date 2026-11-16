import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const roles = await db.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmRoleGrant" WHERE "employeeId" = ${auth.user.id} AND "role" IN ('technician', 'group_head', 'it_manager') LIMIT 1`;
  if (!roles.length) return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403 });
  const groups = await db.$queryRaw`SELECT "id", "name" FROM "ItsmGroup" WHERE "active" = true ORDER BY "name"`;
  return NextResponse.json(groups, { headers: { "Cache-Control": "private, no-store" } });
}
