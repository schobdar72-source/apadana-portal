import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { can } from "@/config/roles";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const validId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const validName = (value: unknown): value is string => typeof value === "string" && value.trim().length > 1 && value.trim().length <= 100;

async function itUnitIds() {
  const units = await db.orgUnit.findMany({ where: { active: true }, select: { id: true, name: true, parentId: true } });
  const normalize = (name: string) => name.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\s]+/g, " ").trim();
  const ids = new Set(units.filter((unit) => normalize(unit.name).includes("فناوری اطلاعات")).map((unit) => unit.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of units) if (unit.parentId !== null && ids.has(unit.parentId) && !ids.has(unit.id)) { ids.add(unit.id); changed = true; }
  }
  return Array.from(ids);
}

async function authorize() {
  const auth = await requireUser();
  if (auth.err) return { err: auth.err };
  const manager = await db.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmRoleGrant" WHERE "employeeId" = ${auth.user.id} AND "role" = 'it_manager'`;
  return { user: auth.user, systemAdmin: can(auth.user.role, "system.config"), manager: manager.length > 0 };
}

export async function GET() {
  const auth = await authorize();
  if (auth.err) return auth.err;
  if (!auth.systemAdmin && !auth.manager) return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403, headers });
  const unitIds = await itUnitIds();
  const [groups, categories, employees, grants, memberships] = await Promise.all([
    db.$queryRaw`SELECT "id", "name", "active" FROM "ItsmGroup" ORDER BY "name"`,
    db.$queryRaw`SELECT "id", "name", "groupId", "active" FROM "ItsmCategory" ORDER BY "name"`,
    db.employee.findMany({ where: { active: true, unitId: { in: unitIds } }, select: { id: true, code: true, firstName: true, lastName: true, locationId: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.$queryRaw`SELECT r."employeeId", r."role" FROM "ItsmRoleGrant" r JOIN "Employee" e ON e."id" = r."employeeId" WHERE e."active" = true AND e."unitId" = ANY(${unitIds}::int[])`,
    db.$queryRaw`SELECT m."employeeId", m."groupId" FROM "ItsmGroupMembership" m JOIN "Employee" e ON e."id" = m."employeeId" WHERE e."active" = true AND e."unitId" = ANY(${unitIds}::int[])`,
  ]);
  return NextResponse.json({ groups, categories, employees, grants, memberships, manager: auth.manager, systemAdmin: auth.systemAdmin }, { headers });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.err) return auth.err;
  if (!auth.systemAdmin && !auth.manager) return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403, headers });
  let data: Record<string, unknown>;
  try { const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); data = body; } catch { return NextResponse.json({ error: "اطلاعات نامعتبر است." }, { status: 400, headers }); }
  const action = data.action;
  const unitIds = await itUnitIds();
  try {
    const result = await db.$transaction(async (transaction) => {
      let targetId: number;
      if (action === "create_group" && auth.manager && validName(data.name)) {
        const rows = await transaction.$queryRaw<{ id: number }[]>`INSERT INTO "ItsmGroup" ("name") VALUES (${data.name.trim()}) RETURNING "id"`;
        targetId = rows[0].id;
      } else if (action === "create_category" && auth.manager && validName(data.name) && validId(data.groupId)) {
        const rows = await transaction.$queryRaw<{ id: number }[]>`INSERT INTO "ItsmCategory" ("name", "groupId") SELECT ${data.name.trim()}, "id" FROM "ItsmGroup" WHERE "id" = ${data.groupId} AND "active" = true RETURNING "id"`;
        if (!rows.length) throw new Error("واحد فعال پیدا نشد.");
        targetId = rows[0].id;
      } else if (action === "set_category_group" && auth.manager && validId(data.categoryId) && validId(data.groupId)) {
        const rows = await transaction.$queryRaw<{ id: number }[]>`UPDATE "ItsmCategory" SET "groupId" = ${data.groupId} WHERE "id" = ${data.categoryId} AND EXISTS (SELECT 1 FROM "ItsmGroup" WHERE "id" = ${data.groupId} AND "active" = true) RETURNING "id"`;
        if (!rows.length) throw new Error("دسته‌بندی یا واحد فعال پیدا نشد.");
        targetId = rows[0].id;
      } else if ((action === "grant_role" || action === "revoke_role") && validId(data.employeeId) && typeof data.role === "string" && ["technician", "group_head", "it_manager", "delegate"].includes(data.role) && (data.role === "it_manager" ? auth.systemAdmin : (auth.systemAdmin || auth.manager))) {
        const person = await transaction.employee.findFirst({ where: { id: data.employeeId, active: true, ...(action === "grant_role" && data.role !== "delegate" ? { unitId: { in: unitIds } } : {}) }, select: { id: true } });
        if (!person) throw new Error("کارمند فعال در واحد فناوری اطلاعات پیدا نشد.");
        if (action === "grant_role") await transaction.$executeRaw`INSERT INTO "ItsmRoleGrant" ("employeeId", "role") VALUES (${data.employeeId}, ${data.role}) ON CONFLICT DO NOTHING`;
        else await transaction.$executeRaw`DELETE FROM "ItsmRoleGrant" WHERE "employeeId" = ${data.employeeId} AND "role" = ${data.role}`;
        targetId = data.employeeId;
      } else if ((action === "add_member" || action === "remove_member") && (auth.systemAdmin || auth.manager) && validId(data.employeeId) && validId(data.groupId)) {
        if (action === "add_member") {
          const count = await transaction.$executeRaw`INSERT INTO "ItsmGroupMembership" ("employeeId", "groupId") SELECT e."id", g."id" FROM "Employee" e CROSS JOIN "ItsmGroup" g WHERE e."id" = ${data.employeeId} AND e."active" = true AND e."unitId" = ANY(${unitIds}::int[]) AND g."id" = ${data.groupId} AND g."active" = true ON CONFLICT DO NOTHING`;
          if (!count) throw new Error("کارمند یا واحد فعال پیدا نشد یا عضویت از قبل وجود دارد.");
        } else await transaction.$executeRaw`DELETE FROM "ItsmGroupMembership" WHERE "employeeId" = ${data.employeeId} AND "groupId" = ${data.groupId}`;
        targetId = data.employeeId;
      } else throw new Error("اطلاعات یا مجوز این عملیات معتبر نیست.");
      await transaction.$executeRaw`INSERT INTO "ItsmAuditEvent" ("actorId", "action", "targetType", "targetId", "details") VALUES (${auth.user.id}, ${String(action)}, 'configuration', ${targetId}, ${JSON.stringify(data)}::jsonb)`;
      return { id: targetId };
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const message = error instanceof Error && (error.message.startsWith("کارمند") || error.message.startsWith("واحد") || error.message.startsWith("دسته‌بندی") || error.message.startsWith("اطلاعات")) ? error.message : "ثبت تنظیمات ممکن نشد؛ اطلاعات تکراری یا نامعتبر را بررسی کنید.";
    return NextResponse.json({ error: message }, { status: 400, headers });
  }
}
