import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";
type Emp = { code: string; name: string; unit: string; locationId: number | null; location: string };

/** فقط کارکنان فعال (مرخصی طولانی‌مدت و پایان‌همکاری حذف می‌شوند). منبع واحد کارکنان: جدول Employee دیتابیس منابع انسانی (فایل data/employees.json حذف شد). */
export async function GET() {
  const g = await requirePerm("cafe.order", "cafe.manage"); if (g.err) return g.err;
  if (g.user.role !== "admin" && !g.user.locationId) return NextResponse.json({ error: "محل خدمت حساب شما تعیین نشده است." }, { status: 403 });
  const rows = await db.employee.findMany({
    where: { active: true, status: "active", ...(g.user.role === "admin" ? {} : { locationId: g.user.locationId }) },
    select: { code: true, firstName: true, lastName: true, locationId: true, unit: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  const locations = await db.location.findMany({ select: { id: true, name: true } });
  const employees: Emp[] = rows.map((r) => ({
    code: r.code,
    name: `${r.firstName} ${r.lastName}`.trim(),
    unit: r.unit?.name ?? "",
    locationId: r.locationId,
    location: locations.find(l => l.id === r.locationId)?.name ?? "محل خدمت ثبت نشده",
  }));
  return NextResponse.json({ source: "hr", employees, error: false });
}

/** فهرست فقط از منابع انسانی ویرایش می‌شود؛ کافی‌شاپ نمی‌تواند آن را بازنویسی کند. */
export async function PUT() {
  return NextResponse.json({ error: "فهرست کارکنان از منابع انسانی مدیریت می‌شود." }, { status: 409 });
}
