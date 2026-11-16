import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const prefix = (groupId: number) => `itsm.response.${groupId}.`;

async function allowed(employeeId: number, groupId: number, manage: boolean) {
  const roles = manage ? ["group_head"] : ["group_head", "technician"];
  const rows = await db.$queryRaw<{ id: number }[]>`SELECT g."id" FROM "ItsmGroup" g JOIN "ItsmGroupMembership" m ON m."groupId" = g."id" JOIN "ItsmRoleGrant" r ON r."employeeId" = m."employeeId" WHERE g."id" = ${groupId} AND g."active" = true AND m."employeeId" = ${employeeId} AND r."role" = ANY(${roles}::text[]) LIMIT 1`;
  return rows.length > 0;
}

function validGroup(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

export async function GET(request: Request) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const groupId = Number(new URL(request.url).searchParams.get("groupId"));
  if (!validGroup(groupId)) return NextResponse.json({ error: "واحد معتبر نیست." }, { status: 400, headers });
  if (!await allowed(auth.user.id, groupId, false)) return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403, headers });
  const rows = await db.setting.findMany({ where: { key: { startsWith: prefix(groupId) } }, orderBy: { key: "asc" } });
  const items = rows.flatMap((row) => {
    try { const data = JSON.parse(row.value); return typeof data.title === "string" && typeof data.body === "string" ? [{ id: row.key.slice(prefix(groupId).length), title: data.title, body: data.body }] : []; } catch { return []; }
  });
  items.sort((first, second) => first.title.localeCompare(second.title, "fa"));
  return NextResponse.json(items, { headers });
}

export async function POST(request: Request) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  let data: Record<string, unknown>;
  try { data = await request.json(); } catch { return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400, headers }); }
  const groupId = data?.groupId;
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const body = typeof data?.body === "string" ? data.body.trim() : "";
  const id = data?.id;
  if (!validGroup(groupId) || !title || title.length > 100 || !body || body.length > 500 || (id !== undefined && (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)))) return NextResponse.json({ error: "عنوان و متن پاسخ معتبر را وارد کنید." }, { status: 400, headers });
  if (!await allowed(auth.user.id, groupId, true)) return NextResponse.json({ error: "تنها سرپرست واحد می‌تواند پاسخ‌ها را مدیریت کند." }, { status: 403, headers });
  const key = prefix(groupId) + (id || randomUUID());
  if (id) {
    const result = await db.setting.updateMany({ where: { key }, data: { value: JSON.stringify({ title, body }) } });
    if (!result.count) return NextResponse.json({ error: "پاسخ پیدا نشد." }, { status: 404, headers });
  } else await db.setting.create({ data: { key, value: JSON.stringify({ title, body }) } });
  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(request: Request) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  let data: Record<string, unknown>;
  try { data = await request.json(); } catch { return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400, headers }); }
  const { groupId, id } = data || {};
  if (!validGroup(groupId) || typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400, headers });
  if (!await allowed(auth.user.id, groupId, true)) return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403, headers });
  const result = await db.setting.deleteMany({ where: { key: prefix(groupId) + id } });
  return result.count ? NextResponse.json({ ok: true }, { headers }) : NextResponse.json({ error: "پاسخ پیدا نشد." }, { status: 404, headers });
}
