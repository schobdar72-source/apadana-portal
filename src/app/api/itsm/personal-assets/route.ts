import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });

export async function GET() {
  const user = await getItsmIdentity();
  if (!user) return fail("ابتدا وارد شوید.", 401);
  if (!user.roles.some(role => ["it_manager", "group_head", "technician"].includes(role))) return fail("دسترسی مدیریت تجهیزات کاربران را ندارید.", 403);
  if (!user.employee.locationId) return fail("محل خدمت شما مشخص نیست.", 403);
  const locationId = user.employee.locationId;
  const [employees, assets] = await Promise.all([
    db.employee.findMany({ where: { active: true, locationId }, select: { id: true, code: true, firstName: true, lastName: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.$queryRaw`SELECT a.*, e."firstName", e."lastName", e."code" FROM "ItsmPersonalAsset" a JOIN "Employee" e ON e."id"=a."employeeId" WHERE a."locationId"=${locationId} AND a."active" ORDER BY e."lastName", e."firstName", a."id" DESC`,
  ]);
  return NextResponse.json({ employees, assets }, { headers });
}

export async function POST(request: Request) {
  const user = await getItsmIdentity();
  if (!user) return fail("ابتدا وارد شوید.", 401);
  if (!user.roles.some(role => ["it_manager", "group_head", "technician"].includes(role))) return fail("دسترسی مدیریت تجهیزات کاربران را ندارید.", 403);
  if (!user.employee.locationId) return fail("محل خدمت شما مشخص نیست.", 403);
  let data: Record<string, unknown>;
  try { data = await request.json(); if (!data || typeof data !== "object" || Array.isArray(data)) throw Error(); } catch { return fail("اطلاعات معتبر نیست."); }
  const employeeId = data.employeeId;
  const assetId = data.id;
  if (typeof employeeId !== "number" || !Number.isSafeInteger(employeeId) || employeeId < 1 || employeeId > 2147483647 || (assetId !== undefined && (typeof assetId !== "number" || !Number.isSafeInteger(assetId) || assetId < 1 || assetId > 2147483647))) return fail("کاربر یا دستگاه معتبر نیست.");
  const keys = ["name", "computerName", "cpu", "ram", "hdd", "ssd", "vga", "ip", "notes", "motherboard", "monitor", "operatingSystem", "mac", "manufacturer", "model", "serial"] as const;
  if (keys.some(key => (data[key] !== undefined && (typeof data[key] !== "string" || (data[key] as string).trim().length > (key === "notes" ? 2000 : 150)))) || typeof data.name !== "string" || !data.name.trim()) return fail("نام دستگاه و مشخصات معتبر را وارد کنید.");
  const [name, computerName, cpu, ram, hdd, ssd, vga, ip, notes, motherboard, monitor, operatingSystem, mac, manufacturer, model, serial] = keys.map(key => typeof data[key] === "string" ? (data[key] as string).trim() : "");
  const locationId = user.employee.locationId;
  const employee = await db.employee.findFirst({ where: { id: employeeId, active: true, locationId }, select: { id: true } });
  if (!employee) return fail("کاربر فعال در محل خدمت شما پیدا نشد.", 404);
  if (assetId !== undefined) {
    const rows = await db.$queryRaw<{id:number}[]>`UPDATE "ItsmPersonalAsset" SET "name"=${name}, "computerName"=${computerName}, "cpu"=${cpu}, "ram"=${ram}, "hdd"=${hdd}, "ssd"=${ssd}, "vga"=${vga}, "ip"=${ip}, "notes"=${notes}, "motherboard"=${motherboard}, "monitor"=${monitor}, "operatingSystem"=${operatingSystem}, "mac"=${mac}, "manufacturer"=${manufacturer}, "model"=${model}, "serial"=${serial}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${assetId} AND "employeeId"=${employeeId} AND "locationId"=${locationId} AND "active" RETURNING "id"`;
    return rows.length ? NextResponse.json(rows[0], { headers }) : fail("دستگاه پیدا نشد.", 404);
  }
  const rows = await db.$queryRaw<{id:number}[]>`INSERT INTO "ItsmPersonalAsset" ("employeeId","locationId","name","computerName","cpu","ram","hdd","ssd","vga","ip","notes","motherboard","monitor","operatingSystem","mac","manufacturer","model","serial","updatedAt") VALUES (${employeeId},${locationId},${name},${computerName},${cpu},${ram},${hdd},${ssd},${vga},${ip},${notes},${motherboard},${monitor},${operatingSystem},${mac},${manufacturer},${model},${serial},CURRENT_TIMESTAMP) RETURNING "id"`;
  return NextResponse.json(rows[0], { status: 201, headers });
}
