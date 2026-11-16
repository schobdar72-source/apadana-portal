import data from "@/data/jalali-events.json";

// مناسبت‌ها و تعطیلات رسمی؛ منبع: https://www.time.ir/event-year
// به‌روزرسانی: node scripts/sync-time-ir.mjs
export type JEvent = { m: number; d: number; title: string; holiday: boolean };
const all = data as Record<string, { updated: string; events: JEvent[] }>;

export const eventsOfDay = (jy: number, jm: number, jd: number): JEvent[] =>
  (all[String(jy)]?.events ?? []).filter((e) => e.m === jm && e.d === jd);

export const hasYearData = (jy: number) => !!all[String(jy)];
export const dataUpdated = (jy: number) => all[String(jy)]?.updated;

/** آیا این روز (شمسی) تعطیل رسمی است؟ (جمعه یا تعطیلی ثبت‌شده در time.ir) */
export const isHoliday = (jy: number, jm: number, jd: number, weekday: number) =>
  weekday === 6 || eventsOfDay(jy, jm, jd).some((e) => e.holiday);
