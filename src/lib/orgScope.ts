import { db } from "./db";


/** Unit ids an employee may see: own unit (+ all descendants if includeChildren). Empty = no unit. */
export async function unitScope(employeeId: number, includeChildren: boolean): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e: any = await db.employee.findUnique({ where: { id: employeeId } });
  if (!e?.unitId) return [];
  if (!includeChildren) return [e.unitId];
  const all = await db.orgUnit.findMany({ select: { id: true, parentId: true } });
  const out: number[] = [e.unitId];
  for (let i = 0; i < out.length; i++) for (const u of all) if (u.parentId === out[i]) out.push(u.id);
  return out;
}

/** Direct + indirect reports via managerId. */
export async function reportsOf(employeeId: number): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = await (db.employee as any).findMany({ select: { id: true, managerId: true } });
  const out: number[] = [];
  const q = [employeeId];
  while (q.length) { const m = q.pop()!; for (const x of all) if (x.managerId === m && !out.includes(x.id)) { out.push(x.id); q.push(x.id); } }
  return out;
}

/** مدیر مستقیم؛ اگر ثبت نشده بود، مسئول واحد (یا واحد والد) به‌جای آن. */
async function managerOf(emp: { id: number; managerId?: number | null; unitId?: number | null }): Promise<number | null> {
  if (emp.managerId) return emp.managerId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const units: any[] = await (db.orgUnit as any).findMany({ select: { id: true, parentId: true, headId: true } });
  let uid = emp.unitId ?? null;
  while (uid) {
    const u = units.find((x) => x.id === uid);
    if (!u) break;
    if (u.headId && u.headId !== emp.id) return u.headId;
    uid = u.parentId;
  }
  return null;
}

/** زنجیره‌ی تأییدکنندگان به ترتیب (نزدیک‌ترین اول). */
export async function approvalChain(employeeId: number, levels: number): Promise<number[]> {
  const out: number[] = [];
  let cur = employeeId;
  for (let i = 0; i < levels; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e: any = await db.employee.findUnique({ where: { id: cur } });
    if (!e) break;
    const m = await managerOf(e);
    if (!m || out.includes(m)) break;
    out.push(m);
    cur = m;
  }
  return out;
}
