import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";
import { can, isRole } from "@/config/roles";
import { validBirthDate } from "@/lib/hrCompleteness";
import { normalizeEmployeeCode } from "@/lib/loginInput";

/** خواندن فهرست و پرونده. ویرایش جدا بررسی می‌شود: مدیر منابع انسانی می‌خواند و نقش می‌دهد؛ مدیر سیستم پرونده را ویرایش می‌کند. */
const canRead = () => requirePerm("employee.read", "org.manage", "employee.manage");

export const dynamic = "force-dynamic";

const FIELDS = ["firstName", "lastName", "gender", "nationalId", "fatherName", "birthCertNo", "birthDate", "birthPlace", "maritalStatus", "education", "fieldOfStudy", "mobile", "email", "address", "hireDate", "contractType", "status", "endDate", "endReason"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const E = db.employee as any;

/** GET ?q=متن → فهرست  |  GET ?id=۱ → پرونده‌ی کامل */
export async function GET(req: Request) {
  const g = await canRead(); if (g.err) return g.err;
  const sp = new URL(req.url).searchParams;
  if (sp.get("id")) {
    const e = await E.findUnique({ where: { id: Number(sp.get("id")) } });
    if (!e) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
    const { passwordHash, failedAttempts, lockedUntil, ...safe } = e; // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ employee: safe });
  }
  if (sp.get("export")) {
    const all = await E.findMany({ orderBy: { code: "asc" } });
    const [us, ls] = await Promise.all([db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }), db.location.findMany({ select: { id: true, name: true } })]);
    const um = new Map(us.map((u) => [u.id, u])); const lm = new Map(ls.map((l) => [l.id, l.name]));
    const path = (id: number | null) => { const a: string[] = []; let c = id ? um.get(id) : undefined; for (let i = 0; c && i < 20; i++) { a.unshift(c.name); c = c.parentId ? um.get(c.parentId) : undefined; } return a.join(" › "); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ list: all.map((e: any) => { const { passwordHash, failedAttempts, lockedUntil, ...r } = e; return { ...r, unit: path(e.unitId), location: e.locationId ? lm.get(e.locationId) ?? "" : "" }; }) }); // eslint-disable-line @typescript-eslint/no-unused-vars
  }
  const q = normalizeEmployeeCode(sp.get("q") ?? "");
  const terms = q.split(/\s+/).filter(Boolean);
  const where = q ? { AND: terms.map(term => ({ OR: [{ code: { contains: term } }, { firstName: { contains: term } }, { lastName: { contains: term } }, { nationalId: { contains: term } }] })) } : {};
  const [list, units, locations, total] = await Promise.all([
    E.findMany({ where, orderBy: { code: "asc" }, select: { id: true, code: true, firstName: true, lastName: true, role: true, active: true, status: true, contractType: true, mobile: true, email: true, positionTitle: true, positionRank: true, unitId: true, locationId: true, birthDate: true, hireDate: true } }),
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true, locationId: true } }),
    db.location.findMany({ where: { active: true }, select: { id: true, name: true } }),
    E.count(),
  ]);
  return NextResponse.json({ list, units, locations, total });
}

/** POST { id?, ...fields, unitId?, locationId?, positionTitle? } — بدون id یعنی ایجاد (رمز اولیه = کد پرسنلی) */
export async function POST(req: Request) {
  const g = await requirePerm("employee.manage", "role.assign"); if (g.err) return g.err;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of FIELDS) if (b[k] !== undefined) data[k] = String(b[k]).trim() || null;
  if (b.unitId !== undefined) data.unitId = b.unitId ? Number(b.unitId) : null;
  if (b.locationId !== undefined) data.locationId = b.locationId ? Number(b.locationId) : null;
  if (b.positionRank !== undefined) data.positionRank = b.positionRank ? Number(b.positionRank) : null;
  if (b.positionTitle !== undefined) data.positionTitle = String(b.positionTitle).trim() || null;
  if (b.role !== undefined) {
    if (b.role === "") return NextResponse.json({ error: "نقش را انتخاب کنید." }, { status: 400 });
    if (!isRole(b.role)) return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
    const cur = b.id ? await E.findUnique({ where: { id: Number(b.id) }, select: { role: true } }) : null;
    if (b.role !== (cur?.role ?? "employee")) {
      if (!can(g.user.role, "role.assign")) return NextResponse.json({ error: "اجازه‌ی تغییر نقش را ندارید." }, { status: 403 });
      if (b.id && Number(b.id) === g.user.id) return NextResponse.json({ error: "نقش خودتان را نمی‌توانید تغییر دهید." }, { status: 400 });
      if ((b.role === "admin" || cur?.role === "admin") && g.user.role !== "admin") return NextResponse.json({ error: "فقط مدیر سیستم می‌تواند نقش «مدیر سیستم» را بدهد یا بگیرد." }, { status: 403 });
      data.role = b.role;
    }
  }
  if (data.nationalId && !/^\d{10}$/.test(String(data.nationalId))) return NextResponse.json({ error: "کد ملی باید ۱۰ رقم باشد." }, { status: 400 });
  if (data.mobile && !/^09\d{9}$/.test(String(data.mobile))) return NextResponse.json({ error: "شماره موبایل باید با 09 شروع و ۱۱ رقم باشد." }, { status: 400 });
  if (data.email && String(data.email).length > 254) return NextResponse.json({ error: "ایمیل خیلی طولانی است." }, { status: 400 });
  if (data.email && !/^\S+@\S+\.\S+$/.test(String(data.email))) return NextResponse.json({ error: "ایمیل نامعتبر است." }, { status: 400 });
  for (const k of ["birthDate", "hireDate", "endDate"]) if (data[k] && !validBirthDate(String(data[k]))) return NextResponse.json({ error: "تاریخ شمسی معتبر را به شکل ۱۴۰۳/۰۵/۱۲ وارد کنید." }, { status: 400 });
  if (data.status && ["left", "retired", "contract_ended"].includes(String(data.status)) && !data.endDate) return NextResponse.json({ error: "برای پایان همکاری، تاریخ پایان را وارد کنید." }, { status: 400 });
  if (b.id && ((b.firstName !== undefined && !data.firstName) || (b.lastName !== undefined && !data.lastName))) return NextResponse.json({ error: "نام و نام خانوادگی الزامی است." }, { status: 400 });
  if (data.status === "active") { data.endDate = null; data.endReason = null; }
  if (data.status && data.status !== "active") data.active = false;
  if (data.status === "active") data.active = true;
  try {
    if (b.unitId !== undefined || b.locationId !== undefined) {
      const previous = b.id ? await db.employee.findUnique({ where: { id: Number(b.id) }, select: { unitId: true, locationId: true } }) : null;
      const unitId = data.unitId !== undefined ? data.unitId as number | null : previous?.unitId;
      const locationId = data.locationId !== undefined ? data.locationId as number | null : previous?.locationId;
      if (unitId && locationId) {
        const unit = await db.orgUnit.findUnique({ where: { id: unitId }, select: { locationId: true } });
        if (unit?.locationId && unit.locationId !== locationId) return NextResponse.json({ error: "محل خدمت کارمند با محل خدمت واحد سازمانی یکسان نیست." }, { status: 400 });
      }
    }
    if (b.id) {
      await E.update({ where: { id: Number(b.id) }, data });
    } else {
      const code = String(b.code ?? "").trim();
      if (!code || !data.firstName || !data.lastName) return NextResponse.json({ error: "کد پرسنلی، نام و نام خانوادگی لازم است." }, { status: 400 });
      const bcrypt = await import("bcryptjs");
      await E.create({ data: { ...data, code, passwordHash: await bcrypt.hash(code, 10), mustChangePass: true } });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as { code?: string })?.code === "P2002" ? "کد پرسنلی یا کد ملی تکراری است." : "خطا در ذخیره" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
