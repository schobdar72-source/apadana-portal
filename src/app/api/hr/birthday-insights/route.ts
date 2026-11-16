import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireHr } from "@/lib/guard";
import { candidates } from "@/lib/portalPeople";
import { jalaliMonthLength, toJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireHr();
  if (guard.err) return guard.err;
  const [employees, locations, upcoming] = await Promise.all([
    db.employee.findMany({ where: { active: true, status: "active" }, select: { id: true, firstName: true, lastName: true, birthDate: true, locationId: true, unit: { select: { name: true } } } }),
    db.location.findMany({ select: { id: true, name: true } }),
    candidates("birthday", 7),
  ]);
  const locationNames = new Map(locations.map(l => [l.id, l.name]));
  const birthdays: { id: number; name: string; unit: string; locationId: number | null; location: string; month: number; day: number }[] = [];
  const incomplete: { id: number; name: string; unit: string; location: string; missingBirthDate: boolean; missingLocation: boolean }[] = [];
  for (const e of employees) {
    const name = `${e.firstName} ${e.lastName}`;
    const location = e.locationId == null ? "" : locationNames.get(e.locationId) || "";
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(e.birthDate || "");
    const year = m ? Number(m[1]) : 0, month = m ? Number(m[2]) : 0, day = m ? Number(m[3]) : 0;
    const valid = year >= 1200 && year <= 1600 && month >= 1 && month <= 12 && day >= 1 && day <= jalaliMonthLength(year, month);
    const missingLocation = !location;
    if (valid) birthdays.push({ id: e.id, name, unit: e.unit?.name || "", locationId: e.locationId, location, month, day });
    if (!valid || missingLocation) incomplete.push({ id: e.id, name, unit: e.unit?.name || "", location, missingBirthDate: !valid, missingLocation });
  }
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  const today = toJalali(parts[0], parts[1], parts[2]);
  return NextResponse.json({ birthdays, incomplete, today, counts: { today: upcoming.filter(r => r.days === 0).length, week: upcoming.filter(r => r.days > 0 && r.days <= 7).length, missingLocation: incomplete.filter(r => r.missingLocation).length, missingBirthDate: incomplete.filter(r => r.missingBirthDate).length } }, { headers: { "Cache-Control": "private, no-store" } });
}
