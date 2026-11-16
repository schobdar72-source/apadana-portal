import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { isSlaPolicy } from "@/lib/itsm/sla";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function manager() {
  const auth = await requireUser(); if (auth.err) return { error: auth.err };
  const roles = await db.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmRoleGrant" WHERE "employeeId" = ${auth.user.id} AND "role" = 'it_manager'`;
  if (!roles.length) return { error: NextResponse.json({ error: "فقط مدیر فناوری اطلاعات به این تنظیمات دسترسی دارد." }, { status: 403, headers }) };
  return { user: auth.user };
}
export async function GET() {
  const auth = await manager(); if (auth.error) return auth.error;
  const rows = await db.$queryRaw<{ id: number; policy: unknown; createdAt: Date }[]>`SELECT "id", "policy", "createdAt" FROM "ItsmSlaPolicyVersion" ORDER BY "id" DESC LIMIT 1`;
  return NextResponse.json(rows[0] ?? null, { headers });
}
export async function POST(request: Request) {
  const auth = await manager(); if (auth.error) return auth.error;
  let policy: unknown;
  try { policy = await request.json(); } catch { return NextResponse.json({ error: "تنظیمات معتبر نیست." }, { status: 400, headers }); }
  if (!isSlaPolicy(policy)) return NextResponse.json({ error: "روزها، ساعت کاری، تعطیلات و مهلت هر چهار اولویت را بررسی کنید." }, { status: 400, headers });
  const json = JSON.stringify(policy);
  const created = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: number }[]>`INSERT INTO "ItsmSlaPolicyVersion" ("policy", "createdById") VALUES (${json}::jsonb, ${auth.user.id}) RETURNING "id"`;
    await tx.$executeRaw`INSERT INTO "ItsmAuditEvent" ("actorId", "action", "targetType", "targetId", "details") VALUES (${auth.user.id}, 'sla_policy_created', 'sla_policy', ${rows[0].id}, ${json}::jsonb)`;
    return rows[0];
  });
  return NextResponse.json(created, { status: 201, headers });
}
