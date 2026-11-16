import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireHr } from "@/lib/guard";

export const dynamic = "force-dynamic";

async function levels() {
  const s = await db.setting.findUnique({ where: { key: "orgLevels" } });
  return Math.min(8, Math.max(1, Number(s?.value) || 3));
}
async function depth(id: number | null): Promise<number> {
  let d = 0;
  while (id) {
    const u = await db.orgUnit.findUnique({ where: { id } });
    if (!u) break;
    d++; id = u.parentId;
  }
  return d;
}

function unitIsInChain(unitId: number | null, managerUnitId: number | null, parents: Map<number, number | null>) {
  if (!unitId || !managerUnitId) return false;
  const visited = new Set<number>();
  let current: number | null = unitId;
  while (current && !visited.has(current)) { if (current === managerUnitId) return true; visited.add(current); current = parents.get(current) ?? null; }
  return false;
}

export async function GET(req: Request) {
  const g = await requireHr(); if (g.err) return g.err;
  const params = new URL(req.url).searchParams;
  const term = params.get("search");
  if (term !== null) {
    const normalized = term.trim().replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/ي/g, "ی").replace(/ك/g, "ک");
    if (!normalized) return NextResponse.json({ results: [], hasMore: false });
    const tokens = normalized.split(/[\s\u200c]+/).filter(Boolean).slice(0, 8);
    const employees = await db.employee.findMany({
      where: { AND: tokens.map(token => {
        const variants = [...new Set([token, token.replace(/ی/g, "ي").replace(/ک/g, "ك")])];
        return { OR: variants.flatMap(value => [{ firstName: { contains: value } }, { lastName: { contains: value } }, { code: { contains: value } }]) };
      }) },
      select: { id: true, code: true, firstName: true, lastName: true, active: true, positionTitle: true, locationId: true, unit: { select: { name: true } } },
      orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }, { code: "asc" }], take: 31,
    });
    const locationIds = [...new Set(employees.flatMap(e => e.locationId == null ? [] : [e.locationId]))];
    const locations = await db.location.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } });
    return NextResponse.json({ results: employees.slice(0, 30).map(e => ({ code: e.code, name: `${e.firstName} ${e.lastName}`, active: e.active, unit: e.unit?.name ?? null, title: e.positionTitle, location: locations.find(l => l.id === e.locationId)?.name ?? null })), hasMore: employees.length > 30 });
  }
  const lookup = params.get("code");
  if (lookup !== null) {
    const e = await db.employee.findUnique({ where: { code: lookup.trim() } });
    if (!e) return NextResponse.json({ employee: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ex = e as any;
    const u = ex.unitId ? await db.orgUnit.findUnique({ where: { id: ex.unitId } }) : null;
    const manager = e.managerId ? await db.employee.findUnique({ where: { id: e.managerId }, select: { code: true } }) : null;
    return NextResponse.json({ employee: { code: e.code, name: `${e.firstName} ${e.lastName}`, active: e.active, unit: u?.name ?? null, unitId: e.unitId, title: e.positionTitle, rank: e.positionRank, managerCode: manager?.code ?? "", isHead: u?.headId === e.id } });
  }
  const [units, locations, lv, activeEmployees, withoutUnit] = await Promise.all([db.orgUnit.findMany({ orderBy: { id: "asc" } }), db.location.findMany({ orderBy: { id: "asc" } }), levels(), db.employee.count({ where: { active: true } }), db.employee.count({ where: { active: true, status: "active", unitId: null } })]);
  // headcount per unit (direct). Safe if the unitId migration has not been applied yet.
  const counts: Record<number, number> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = await (db.employee as any).groupBy({ by: ["unitId"], where: { active: true, unitId: { not: null } }, _count: { _all: true } });
    for (const x of gs) counts[x.unitId] = x._count._all;
  } catch { /* migration pending */ }
  // people per unit (for chart). Safe if migration not applied.
  let people: { id: number; code: string; name: string; unitId: number; title: string | null; rank: number | null; managerId: number | null; locationId: number | null }[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const es = await (db.employee as any).findMany({ where: { active: true, unitId: { not: null } }, orderBy: [{ positionRank: "asc" }, { id: "asc" }] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    people = es.map((e: any) => ({ id: e.id, code: e.code, name: `${e.firstName} ${e.lastName}`, unitId: e.unitId, title: e.positionTitle ?? null, rank: e.positionRank ?? null, managerId: e.managerId ?? null, locationId: e.locationId ?? null }));
  } catch { /* migration pending */ }
  const locationGroups = await db.employee.groupBy({ by: ["locationId"], where: { active: true, locationId: { not: null } }, _count: { _all: true } });
  const locationCounts = Object.fromEntries(locationGroups.map(x => [x.locationId, x._count._all]));
  const unassignedGroups = await db.employee.groupBy({ by: ["locationId"], where: { active: true, status: "active", unitId: null }, _count: { _all: true } });
  const unassignedByLocation = Object.fromEntries(unassignedGroups.map(x => [x.locationId ?? "none", x._count._all]));
  return NextResponse.json({ units, locations, levels: lv, counts, people, locationCounts, activeEmployees, withoutUnit, unassignedByLocation });
}

/** body: { op: "unit.add"|"unit.edit"|"loc.add"|"loc.edit"|"levels", ... } */
export async function POST(req: Request) {
  const g = await requireHr(); if (g.err) return g.err;
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  try {
    switch (b.op) {
      case "unit.add": {
        if (!name) return NextResponse.json({ error: "نام واحد را وارد کنید." }, { status: 400 });
        const parentId = b.parentId ? Number(b.parentId) : null;
        const locationId = Number(b.locationId);
        if (!locationId || !(await db.location.findFirst({ where: { id: locationId, active: true } }))) return NextResponse.json({ error: "محل خدمت فعال و معتبر انتخاب کنید." }, { status: 400 });
        if (parentId && !(await db.orgUnit.findFirst({ where: { id: parentId, active: true, locationId } }))) return NextResponse.json({ error: "واحد بالادستی باید فعال و متعلق به همان محل خدمت باشد." }, { status: 400 });
        if ((await depth(parentId)) + 1 > (await levels())) return NextResponse.json({ error: "تعداد سطح‌های مجاز تمام شده است." }, { status: 400 });
        await db.orgUnit.create({ data: { name, parentId, locationId } });
        break;
      }
      case "unit.edit": {
        const data: { name?: string; active?: boolean; parentId?: number | null } = {};
        if (name) data.name = name;
        if (typeof b.active === "boolean") data.active = b.active;
        if (b.parentId !== undefined) {
          const id = Number(b.id);
          const newParent = b.parentId ? Number(b.parentId) : null;
          if (newParent && !(await db.orgUnit.findFirst({ where: { id: newParent, active: true } }))) return NextResponse.json({ error: "واحد بالادستی فعال و معتبر انتخاب کنید." }, { status: 400 });
          const moving = await db.orgUnit.findUnique({ where: { id } });
          const parentUnit = newParent ? await db.orgUnit.findUnique({ where: { id: newParent } }) : null;
          if (parentUnit && moving?.locationId !== parentUnit.locationId) return NextResponse.json({ error: "واحد بالادستی باید متعلق به همان محل خدمت باشد." }, { status: 400 });
          if (newParent === id) return NextResponse.json({ error: "واحد نمی‌تواند زیرمجموعه‌ی خودش باشد." }, { status: 400 });
          // walk up from new parent: if we hit this unit, it would create a cycle
          for (let p = newParent; p; ) {
            if (p === id) return NextResponse.json({ error: "این انتقال حلقه می‌سازد." }, { status: 400 });
            const pu = await db.orgUnit.findUnique({ where: { id: p } });
            p = pu?.parentId ?? 0;
          }
          // deepest level of this unit's subtree after the move
          const all = await db.orgUnit.findMany();
          const kids = (x: number): number[] => all.filter((u) => u.parentId === x).map((u) => u.id);
          const subDepth = (x: number): number => { const c = kids(x); return c.length ? 1 + Math.max(...c.map(subDepth)) : 0; };
          const newDepth = (await depth(newParent)) + 1 + subDepth(id);
          if (newDepth > (await levels())) return NextResponse.json({ error: "تعداد سطح‌ها از حد مجاز بیشتر می‌شود." }, { status: 400 });
          const parentsBefore = new Map(all.map(u => [u.id, u.parentId]));
          const parentsAfter = new Map(parentsBefore); parentsAfter.set(id, newParent);
          const assigned = await db.employee.findMany({ where: { active: true, managerId: { not: null } }, select: { id: true, unitId: true, managerId: true } });
          const managers = await db.employee.findMany({ where: { id: { in: assigned.flatMap(e => e.managerId ? [e.managerId] : []) } }, select: { id: true, unitId: true } });
          const managerUnits = new Map(managers.map(m => [m.id, m.unitId]));
          if (assigned.some(e => unitIsInChain(e.unitId, managerUnits.get(e.managerId!) ?? null, parentsBefore) && !unitIsInChain(e.unitId, managerUnits.get(e.managerId!) ?? null, parentsAfter))) return NextResponse.json({ error: "این جابه‌جایی مدیر مستقیم بعضی کارکنان را خارج از زنجیره واحدشان قرار می‌دهد. ابتدا مدیر مستقیم آن‌ها را اصلاح کنید." }, { status: 400 });
          data.parentId = newParent;
        }
        await db.orgUnit.update({ where: { id: Number(b.id) }, data });
        break;
      }
      case "unit.location": {
        const id = Number(b.id), locationId = Number(b.locationId);
        const [unit, location, all] = await Promise.all([db.orgUnit.findUnique({ where: { id } }), db.location.findFirst({ where: { id: locationId, active: true } }), db.orgUnit.findMany()]);
        if (!unit || !location) return NextResponse.json({ error: "واحد و محل خدمت فعال را انتخاب کنید." }, { status: 400 });
        if (unit.parentId && all.find(u => u.id === unit.parentId)?.locationId !== locationId) return NextResponse.json({ error: "محل خدمت باید با واحد بالادستی یکسان باشد؛ ابتدا محل واحد بالادستی را تعیین کنید." }, { status: 400 });
        const descendants = [id]; for (let i = 0; i < descendants.length; i++) for (const u of all) if (u.parentId === descendants[i] && !descendants.includes(u.id)) descendants.push(u.id);
        const conflicts = await db.employee.count({ where: { unitId: { in: descendants }, locationId: { not: null }, NOT: { locationId } } });
        if (conflicts) return NextResponse.json({ error: `محل خدمت ${conflicts.toLocaleString("fa-IR")} کارمند این واحد یا زیرواحدها متفاوت است؛ ابتدا تخصیص آن‌ها را اصلاح کنید.` }, { status: 400 });
        await db.orgUnit.updateMany({ where: { id: { in: descendants } }, data: { locationId } });
        break;
      }
      case "emp.assign": {
        const code = String(b.code ?? "").trim();
        const emp = await db.employee.findUnique({ where: { code } });
        if (!emp) return NextResponse.json({ error: "پرسنلی با این کد پیدا نشد." }, { status: 400 });
        if (!emp.active) return NextResponse.json({ error: "امکان تخصیص کارمند غیرفعال وجود ندارد." }, { status: 400 });
        const unitId = Number(b.unitId);
        const unit = await db.orgUnit.findFirst({ where: { id: unitId, active: true } });
        if (!unit) return NextResponse.json({ error: "واحد فعال و معتبر انتخاب کنید." }, { status: 400 });
        if (unit.locationId && emp.locationId && unit.locationId !== emp.locationId) return NextResponse.json({ error: "محل خدمت کارمند با محل خدمت واحد انتخاب‌شده یکسان نیست." }, { status: 400 });
        const rank = b.rank ? Number(b.rank) : null;
        if (rank !== null && ![1, 2, 3, 4, 5, 6].includes(rank)) return NextResponse.json({ error: "رتبه معتبر انتخاب کنید." }, { status: 400 });
        const manager = b.managerCode ? await db.employee.findUnique({ where: { code: String(b.managerCode).trim() } }) : null;
        if (b.managerCode && (!manager || !manager.active || manager.id === emp.id)) return NextResponse.json({ error: "مدیر مستقیم معتبر و فعال انتخاب کنید." }, { status: 400 });
        if (manager) {
          const units = await db.orgUnit.findMany();
          const chain = new Set<number>(); let current: typeof unit | undefined = unit;
          while (current && !chain.has(current.id)) { chain.add(current.id); current = units.find(u => u.id === current!.parentId); }
          if (!manager.unitId || !chain.has(manager.unitId) || (manager.positionRank ?? 99) >= (rank ?? 99)) return NextResponse.json({ error: "مدیر باید در زنجیره واحد انتخابی و دارای رتبه بالاتر باشد." }, { status: 400 });
          const visited = new Set<number>(); let next: number | null = manager.id;
          while (next) { if (next === emp.id || visited.has(next)) return NextResponse.json({ error: "این انتخاب باعث ایجاد حلقه در زنجیره مدیران می‌شود." }, { status: 400 }); visited.add(next); const person: { managerId: number | null } | null = await db.employee.findUnique({ where: { id: next }, select: { managerId: true } }); next = person?.managerId ?? null; }
        }
        const directReports = await db.employee.findMany({ where: { active: true, managerId: emp.id }, select: { unitId: true, positionRank: true } });
        if (directReports.length) {
          const units = await db.orgUnit.findMany({ select: { id: true, parentId: true } });
          const parents = new Map(units.map(u => [u.id, u.parentId]));
          if (directReports.some(report => unitIsInChain(report.unitId, emp.unitId, parents) && (emp.positionRank ?? 99) < (report.positionRank ?? 99) && (!unitIsInChain(report.unitId, unitId, parents) || (rank ?? 99) >= (report.positionRank ?? 99)))) return NextResponse.json({ error: "این تغییر، مدیر مستقیم بعضی کارکنان را نامعتبر می‌کند. ابتدا رابطه مدیریتی آن‌ها را اصلاح کنید." }, { status: 400 });
        }
        await db.$transaction(async tx => {
          await tx.orgUnit.updateMany({ where: { headId: emp.id, id: { not: unitId } }, data: { headId: null } });
          await tx.employee.update({ where: { id: emp.id }, data: { unitId, positionTitle: b.title ? String(b.title).trim() : null, positionRank: rank, managerId: manager?.id ?? null } });
          if (b.isHead) await tx.orgUnit.update({ where: { id: unitId }, data: { headId: emp.id } });
          else await tx.orgUnit.updateMany({ where: { id: unitId, headId: emp.id }, data: { headId: null } });
        });
        break;
      }
      case "unit.delete": {
        const id = Number(b.id);
        if (await db.orgUnit.count({ where: { parentId: id } })) return NextResponse.json({ error: "ابتدا زیرواحدهای این واحد را حذف کنید." }, { status: 400 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (await (db.employee as any).count({ where: { unitId: id } })) return NextResponse.json({ error: "ابتدا پرسنل این واحد را جابه‌جا کنید." }, { status: 400 });
        await db.orgUnit.delete({ where: { id } });
        break;
      }
      case "loc.add": {
        if (!name) return NextResponse.json({ error: "نام محل را وارد کنید." }, { status: 400 });
        await db.location.create({ data: { name, kind: b.kind === "mine" ? "mine" : "office" } });
        break;
      }
      case "loc.edit": {
        const data: { name?: string; kind?: string; active?: boolean } = {};
        if (name) data.name = name;
        if (b.kind) data.kind = b.kind === "mine" ? "mine" : "office";
        if (typeof b.active === "boolean") data.active = b.active;
        await db.location.update({ where: { id: Number(b.id) }, data });
        break;
      }
      case "levels": {
        const n = Number(b.value);
        if (![1, 2, 3, 4, 5, 6, 7, 8].includes(n)) return NextResponse.json({ error: "مقدار نامعتبر" }, { status: 400 });
        const units = await db.orgUnit.findMany();
        const byId = new Map(units.map((u) => [u.id, u]));
        const dep = (u: { parentId: number | null }): number => (u.parentId ? 1 + dep(byId.get(u.parentId)!) : 1);
        if (units.some((u) => dep(u) > n)) return NextResponse.json({ error: "واحدهایی در سطح‌های بالاتر از این مقدار وجود دارد." }, { status: 400 });
        await db.setting.upsert({ where: { key: "orgLevels" }, update: { value: String(n) }, create: { key: "orgLevels", value: String(n) } });
        break;
      }
      default: return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.code === "P2002" ? "این نام قبلاً ثبت شده است." : "خطا در ذخیره" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
