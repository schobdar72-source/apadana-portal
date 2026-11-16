import { db } from "./db";
import { toGregorian, toJalali, jalaliMonthLength, jalaliMonths } from "./jalali";

export type Kind = "birthday" | "hire";
export const DEFAULTS: Record<Kind, { days: number; text: string; todayText: string }> = {
  birthday: { days: 7, text: "تولد: {date}", todayText: "تولدت مبارک 🎂" },
  hire: { days: 20, text: "به خانواده‌ی بزرگ آپادانا خوش آمدید", todayText: "" },
};
export const MAX_DAYS: Record<Kind, number> = { birthday: 60, hire: 365 };
// locs خالی = همه‌ی محل‌ها. mode=all: همه جز hidden؛ mode=approved: فقط approved.
export type Cfg = { locs: number[]; hidden: number[]; mode: "all" | "approved"; approved: number[]; days: number; text: string; todayText: string; hirePeriod?: "days" | "month" };
export type Row = { id: number; name: string; unit: string; unitId: number | null; title: string; locationId: number | null; location: string; days: number; label: string };

export const parseJalaliDate = (s?: string | null) => {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s || "");
  if (!m) return null;
  const date = { y: +m[1], m: +m[2], d: +m[3] };
  return date.y >= 1200 && date.y <= 1600 && date.m >= 1 && date.m <= 12 && date.d >= 1 && date.d <= jalaliMonthLength(date.y, date.m) ? date : null;
};
const utc = (jy: number, jm: number, jd: number) => { const g = toGregorian(jy, jm, jd); return Date.UTC(g.gy, g.gm - 1, g.gd); };

export async function getCfg(kind: Kind): Promise<Cfg> {
  const s = await db.setting.findUnique({ where: { key: `portal.${kind}` } });
  let j: Partial<Cfg> = {};
  try { j = JSON.parse(s?.value || "{}"); } catch {}
  const d = DEFAULTS[kind];
  const days = Math.min(MAX_DAYS[kind], Math.max(1, Math.floor(Number(j.days)) || d.days));
  return { hirePeriod: kind === "hire" && j.hirePeriod === "month" ? "month" : "days", locs: j.locs || [], hidden: j.hidden || [], mode: j.mode === "approved" ? "approved" : "all", approved: j.approved || [], days, text: j.text || d.text, todayText: j.todayText ?? d.todayText };
}
export async function setCfg(kind: Kind, c: Cfg) {
  const value = JSON.stringify(c);
  await db.setting.upsert({ where: { key: `portal.${kind}` }, update: { value }, create: { key: `portal.${kind}`, value } });
}

/** فاصله از آغاز ماه شمسی جاری تا امروز بر اساس زمان تهران. */
export function effectiveWindow(kind: Kind, cfg: Cfg): number {
  if (kind !== "hire") return cfg.days;
  if (cfg.hirePeriod !== "month") return cfg.days - 1;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  return toJalali(parts[0], parts[1], parts[2]).jd - 1;
}

/** همه‌ی افراد واجد شرط (بدون اعمال فیلتر و مخفی‌سازی). فقط همکاران فعال. */
export async function candidates(kind: Kind, win: number): Promise<Row[]> {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date()).split("-").map(Number);
  const tj = toJalali(ymd[0], ymd[1], ymd[2]);
  const t0 = Date.UTC(ymd[0], ymd[1] - 1, ymd[2]);
  const [emps, locs] = await Promise.all([
    db.employee.findMany({
      where: { active: true, status: "active" },
      select: { id: true, firstName: true, lastName: true, birthDate: true, hireDate: true, positionTitle: true, unitId: true, locationId: true, unit: { select: { name: true } } },
    }),
    db.location.findMany({ select: { id: true, name: true } }),
  ]);
  const lname = new Map(locs.map((l) => [l.id, l.name]));
  const out: Row[] = [];
  for (const e of emps) {
    const base = { id: e.id, name: `${e.firstName} ${e.lastName}`, unit: e.unit?.name || "", unitId: e.unitId, title: e.positionTitle || "", locationId: e.locationId, location: e.locationId ? lname.get(e.locationId) || "" : "" };
    if (kind === "birthday") {
      const b = parseJalaliDate(e.birthDate); if (!b) continue;
      for (const y of [tj.jy, tj.jy + 1]) {
        const d = Math.min(b.d, jalaliMonthLength(y, b.m));
        const diff = (utc(y, b.m, d) - t0) / 864e5;
        if (diff >= 0) { if (diff <= win) out.push({ ...base, days: diff, label: `${d} ${jalaliMonths[b.m - 1]}` }); break; }
      }
    } else {
      const h = parseJalaliDate(e.hireDate); if (!h) continue;
      const ago = (t0 - utc(h.y, h.m, h.d)) / 864e5;
      if (ago >= 0 && ago <= win) out.push({ ...base, days: ago, label: `${h.d} ${jalaliMonths[h.m - 1]} ${h.y}` });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

export const isShown = (r: Row, c: Cfg) =>
  (c.mode === "approved" ? c.approved.includes(r.id) : !c.hidden.includes(r.id)) && (!c.locs.length || (r.locationId != null && c.locs.includes(r.locationId)));
export const visible = (rows: Row[], c: Cfg) => rows.filter((r) => isShown(r, c));
export const noteOf = (kind: Kind, c: Cfg, r: Row) =>
  kind === "birthday" && r.days === 0 && c.todayText ? c.todayText : c.text.replace("{date}", r.label);
