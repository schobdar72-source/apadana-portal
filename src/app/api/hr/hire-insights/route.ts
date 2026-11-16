import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireHr } from "@/lib/guard";
import { candidates, effectiveWindow, getCfg, parseJalaliDate } from "@/lib/portalPeople";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireHr();
  if (guard.err) return guard.err;
  const cfg = await getCfg("hire");
  const [employees, recent, month] = await Promise.all([
    db.employee.findMany({ where: { active: true, status: "active" }, select: { id: true, firstName: true, lastName: true, hireDate: true, locationId: true } }),
    candidates("hire", 89),
    candidates("hire", effectiveWindow("hire", { ...cfg, hirePeriod: "month" })),
  ]);
  const incomplete = employees.filter(e => !parseJalaliDate(e.hireDate) || e.locationId == null).map(e => ({
    id: e.id, name: `${e.firstName} ${e.lastName}`, missingDate: !parseJalaliDate(e.hireDate), missingLocation: e.locationId == null,
  }));
  return NextResponse.json({ counts: { threeMonths: recent.length, month: month.length, missingDate: incomplete.filter(e => e.missingDate).length, missingLocation: incomplete.filter(e => e.missingLocation).length }, incomplete }, { headers: { "Cache-Control": "private, no-store" } });
}
