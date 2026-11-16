import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm, requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";
const prefix = "phonebook.employee.";

export async function GET() {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  try {
    const [employees, locations, records] = await Promise.all([
      db.employee.findMany({ where: { active: true }, select: { id: true, code: true, firstName: true, lastName: true, positionTitle: true, locationId: true, unit: { select: { id: true, name: true, locationId: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
      db.location.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.setting.findMany({ where: { key: { startsWith: prefix } }, select: { key: true, value: true } }),
    ]);
    const details = new Map(records.map(record => {
      try { return [record.key, JSON.parse(record.value)] as const; } catch { return [record.key, {}] as const; }
    }));
    return NextResponse.json({ employees: employees.map(employee => ({ ...employee, details: details.get(prefix + employee.id) ?? {} })), locations }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "دریافت دفترچه تلفن ممکن نشد." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  const auth = await requirePerm("system.config");
  if (auth.err) return auth.err;
  try {
    const body = await request.json();
    if (!Number.isSafeInteger(body.id) || body.id < 1 || ![body.extension, body.phone, body.place].every(value => typeof value === "string" && value.length <= 100)) return NextResponse.json({ error: "اطلاعات واردشده معتبر نیست." }, { status: 400 });
    if (![body.extension, body.phone].every(value => /^[0-9۰-۹٠-٩+()\-\s]*$/.test(value))) return NextResponse.json({ error: "شماره تماس معتبر نیست." }, { status: 400 });
    const employee = await db.employee.findUnique({ where: { id: body.id }, select: { id: true, active: true } });
    if (!employee?.active) return NextResponse.json({ error: "کارمند فعال پیدا نشد." }, { status: 404 });
    const key = prefix + body.id;
    const details = { extension: body.extension.trim(), phone: body.phone.trim(), place: body.place.trim(), updatedAt: new Date().toISOString(), updatedBy: `${auth.user.firstName} ${auth.user.lastName}`.trim() };
    const value = JSON.stringify(details);
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return NextResponse.json({ ok: true, details });
  } catch { return NextResponse.json({ error: "ذخیره اطلاعات ممکن نشد." }, { status: 500 }); }
}
