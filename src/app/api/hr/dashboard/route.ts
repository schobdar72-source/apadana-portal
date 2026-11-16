import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";
import { candidates, getCfg } from "@/lib/portalPeople";
import { validBirthDate } from "@/lib/hrCompleteness";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePerm("employee.read", "org.manage");
  if (auth.err) return auth.err;
  const params = new URL(request.url).searchParams;
  const location = params.get("location") || "", unit = params.get("unit") || "";
  if ((location && location !== "missing" && !/^[1-9]\d*$/.test(location)) || (unit && unit !== "missing" && !/^[1-9]\d*$/.test(unit))) return NextResponse.json({ error: "فیلتر نامعتبر است." }, { status: 400 });
  const [employees, locations, units, cfg] = await Promise.all([
    db.employee.findMany({ select: { id: true, active: true, status: true, unitId: true, locationId: true, positionTitle: true, birthDate: true } }),
    db.location.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.orgUnit.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCfg("hire"),
  ]);
  const rows = employees.filter(e => (!location || (location === "missing" ? e.locationId == null : e.locationId === Number(location))) && (!unit || (unit === "missing" ? e.unitId == null : e.unitId === Number(unit))));
  const active = rows.filter(e => e.active && e.status === "active");
  const issues = {
    location: active.filter(e => e.locationId == null).length,
    unit: active.filter(e => e.unitId == null).length,
    position: active.filter(e => !e.positionTitle?.trim()).length,
    birthdate: active.filter(e => !validBirthDate(e.birthDate)).length,
  };
  const incomplete = active.filter(e => e.locationId == null || e.unitId == null || !e.positionTitle?.trim()).length;
  const locationsCount = new Map<number | null, number>(), statuses = new Map<string, number>();
  for (const e of active) locationsCount.set(e.locationId, (locationsCount.get(e.locationId) || 0) + 1);
  for (const e of rows) statuses.set(e.status, (statuses.get(e.status) || 0) + 1);
  const names = new Map(locations.map(l => [l.id, l.name]));
  const allowedIds = new Set(active.map(e => e.id));
  const hires = (await candidates("hire", cfg.days)).filter(e => allowedIds.has(e.id)).length;
  return NextResponse.json({ total: rows.length, active: active.length, incomplete, issues, hires, hireDays: cfg.days,
    statuses: [...statuses].map(([name, count]) => ({ name, count })),
    locations: [...locationsCount].map(([id, count]) => ({ id, name: id == null ? "ثبت نشده" : names.get(id) || "محل نامشخص", count })),
    locationOptions: locations, unitOptions: units,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
