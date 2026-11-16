import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** پرونده‌ی خود کاربر واردشده (بدون رمز و اطلاعات ورود). */
export async function GET() {
  const g = await requireUser(); if (g.err) return g.err;
  const e = await db.employee.findUnique({ where: { id: g.user.id } });
  if (!e) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const [units, loc] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    e.locationId ? db.location.findUnique({ where: { id: e.locationId }, select: { name: true } }) : null,
  ]);
  const byId = new Map(units.map((u) => [u.id, u]));
  const parts: string[] = [];
  for (let c = e.unitId ? byId.get(e.unitId) : undefined, i = 0; c && i < 20; i++) {
    parts.unshift(c.name);
    c = c.parentId ? byId.get(c.parentId) : undefined;
  }

  const { passwordHash, failedAttempts, lockedUntil, ...safe } = e; // eslint-disable-line @typescript-eslint/no-unused-vars
  return NextResponse.json({ employee: { ...safe, unit: parts.join(" › "), location: loc?.name ?? "" } });
}
