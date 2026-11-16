import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";
import { EMP_COLS, EMP_ENUMS, EMP_RANKS, normText } from "@/lib/empSheet";
import { validBirthDate } from "@/lib/hrCompleteness";

export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const E = db.employee as any;
const TEXT = ["firstName", "lastName", "fatherName", "birthCertNo", "birthPlace", "fieldOfStudy", "mobile", "email", "address", "endReason", "positionTitle"];

const normDate = (s: string) => {
  const m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(s);
  if (!m) return null;
  const mo = +m[2], d = +m[3];
  if (+m[1] < 1300 || +m[1] > 1410 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const value = `${m[1]}/${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  return validBirthDate(value) ? value : null;
};

/** POST { rows: Record<عنوان ستون, متن>[], mode: "create"|"update"|"upsert", dryRun } */
export async function POST(req: Request) {
  const g = await requirePerm("employee.manage"); if (g.err) return g.err;
  const { rows, mode = "upsert", dryRun = true } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "ردیفی برای ورود نیست." }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ error: "حداکثر ۲۰۰۰ ردیف در هر بار." }, { status: 400 });

  const [units, locs, existing] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true, locationId: true } }),
    db.location.findMany({ select: { id: true, name: true } }),
    E.findMany({ select: { id: true, code: true, nationalId: true, status: true, endDate: true, unitId: true, locationId: true } }),
  ]);
  const um = new Map(units.map((u) => [u.id, u]));
  const pathOf = (id: number) => { const a: string[] = []; let c = um.get(id); for (let i = 0; c && i < 20; i++) { a.unshift(c.name); c = c.parentId ? um.get(c.parentId) : undefined; } return a; };
  const byPath = new Map<string, number[]>(), byName = new Map<string, number[]>();
  for (const u of units) {
    const pp = normText(pathOf(u.id).join(" › ")), nn = normText(u.name);
    byPath.set(pp, [...(byPath.get(pp) ?? []), u.id]); byName.set(nn, [...(byName.get(nn) ?? []), u.id]);
  }
  const lm = new Map(locs.map((l) => [normText(l.name), l.id]));
  const byCode = new Map<string, { id: number; nationalId: string | null; status: string; endDate: string | null; unitId: number | null; locationId: number | null }>(existing.map((e: { id: number; code: string; nationalId: string | null; status: string; endDate: string | null; unitId: number | null; locationId: number | null }) => [e.code, e]));
  const nidOwner = new Map<string, string>(existing.filter((e: { nationalId: string | null }) => e.nationalId).map((e: { code: string; nationalId: string }) => [e.nationalId, e.code]));
  const seen = new Set<string>();

  const result: { row: number; code: string; action: "create" | "update" | "skip" | "error"; errors: string[] }[] = [];
  const ops: { create: boolean; id?: number; code: string; data: Record<string, unknown> }[] = [];
  const bcrypt = await import("bcryptjs");

  rows.forEach((raw: Record<string, string>, i: number) => {
    const rowNo = i + 2; const errors: string[] = [];
    const v: Record<string, string> = {};
    for (const [k, label] of EMP_COLS) v[k] = normText(raw[label]);
    const code = v.code;
    if (!code) { result.push({ row: rowNo, code: "", action: "error", errors: ["کد پرسنلی خالی است."] }); return; }
    if (seen.has(code)) errors.push("کد پرسنلی در فایل تکراری است."); seen.add(code);
    const ex = byCode.get(code);
    const create = !ex;
    if (create && mode === "update") { result.push({ row: rowNo, code, action: "skip", errors: [] }); return; }
    if (!create && mode === "create") { result.push({ row: rowNo, code, action: "skip", errors: ["قبلاً ثبت شده؛ نادیده گرفته شد."] }); return; }
    if (/^\d{1,10}$/.test(v.mobile ?? "") && v.mobile.length < 11 && v.mobile.length >= 9) v.mobile = v.mobile.padStart(11, "0");
    if (v.mobile && !/^09\d{9}$/.test(v.mobile)) errors.push("شماره موبایل باید با 09 شروع و ۱۱ رقم باشد.");
    const data: Record<string, unknown> = {};
    for (const k of TEXT) if (v[k]) data[k] = v[k];
    for (const k of Object.keys(EMP_ENUMS)) if (v[k]) {
      const hit = EMP_ENUMS[k].find(([val, l]) => normText(l) === v[k] || val === v[k].toLowerCase());
      if (hit) data[k] = hit[0]; else errors.push(`«${EMP_COLS.find((c) => c[0] === k)![1]}» نامعتبر است: ${v[k]}`);
    }
    for (const k of ["birthDate", "hireDate", "endDate"]) if (v[k]) {
      const d = normDate(v[k]); if (d) data[k] = d; else errors.push(`تاریخ «${EMP_COLS.find((c) => c[0] === k)![1]}» نامعتبر است (نمونه: ۱۴۰۳/۰۵/۱۲).`);
    }
    // Excel often drops leading zeros of numeric-looking cells (e.g. 0912... → 912...; کد ملی 0012345678 → 12345678)
    if (/^\d{1,9}$/.test(v.nationalId ?? "") && v.nationalId.length < 10) v.nationalId = v.nationalId.padStart(10, "0");
    if (v.nationalId) {
      if (!/^\d{10}$/.test(v.nationalId)) errors.push("کد ملی باید ۱۰ رقم باشد.");
      else {
        const owner = nidOwner.get(v.nationalId);
        if (owner && owner !== code) errors.push("کد ملی متعلق به کارمند دیگری است.");
        else { data.nationalId = v.nationalId; nidOwner.set(v.nationalId, code); }
      }
    }
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) errors.push("ایمیل نامعتبر است.");
    if (v.location) { const id = lm.get(v.location); if (id) data.locationId = id; else errors.push(`محل خدمت پیدا نشد: ${v.location}`); }
    if (v.unit) {
      let ids = byPath.get(v.unit) ?? byName.get(v.unit) ?? [];
      const targetLocation = (data.locationId as number | undefined) ?? ex?.locationId;
      if (ids.length > 1 && targetLocation) ids = ids.filter(id => um.get(id)?.locationId === targetLocation);
      if (ids.length === 1) data.unitId = ids[0];
      else errors.push(ids.length ? "نام واحد تکراری است؛ محل خدمت و مسیر کامل واحد را مشخص کنید." : `واحد سازمانی مطابق محل خدمت پیدا نشد: ${v.unit}`);
    }
    if (data.unitId !== undefined || data.locationId !== undefined) {
      const uid = (data.unitId as number | undefined) ?? ex?.unitId, lid = (data.locationId as number | undefined) ?? ex?.locationId;
      if (uid && lid && um.get(uid)?.locationId && um.get(uid)?.locationId !== lid) errors.push("محل خدمت با محل واحد سازمانی یکسان نیست.");
    }
    if (v.rank) { const r = EMP_RANKS.find(([n, l]) => normText(l) === v.rank || String(n) === v.rank); if (r) data.positionRank = r[0]; else errors.push(`رتبه نامعتبر است: ${v.rank}`); }
    if (create) {
      if (!v.firstName || !v.lastName) errors.push("نام و نام خانوادگی لازم است.");
    }
    if (["left", "retired", "contract_ended"].includes(String(data.status ?? ex?.status ?? "")) && !data.endDate && !ex?.endDate) errors.push("برای پایان همکاری، تاریخ پایان لازم است.");
    if (data.status === "active") { data.endDate = null; data.endReason = null; data.active = true; }
    else if (data.status) data.active = false;
    if (errors.length) { result.push({ row: rowNo, code, action: "error", errors }); return; }
    result.push({ row: rowNo, code, action: create ? "create" : "update", errors: [] });
    ops.push({ create, id: ex?.id, code, data });
  });

  const summary = { create: 0, update: 0, skip: 0, error: 0 };
  for (const r of result) summary[r.action]++;
  if (dryRun) return NextResponse.json({ summary, result });
  if (summary.error) return NextResponse.json({ error: "ابتدا خطاها را اصلاح کنید.", summary, result }, { status: 400 });

  try {
    const prepared = [];
    for (const o of ops) prepared.push(o.create
      ? E.create({ data: { ...o.data, code: o.code, passwordHash: await bcrypt.hash(o.code, 10), mustChangePass: true } })
      : E.update({ where: { id: o.id }, data: o.data }));
    await db.$transaction(prepared);
  } catch {
    return NextResponse.json({ error: "خطا در ذخیره؛ هیچ تغییری اعمال نشد." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, summary, result });
}
