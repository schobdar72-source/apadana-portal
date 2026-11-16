"use client";
import eventData from "@/data/jalali-events.json";
import { toGregorian, toJalali, jalaliMonthLength } from "@/lib/jalali";
import { useCallback, useEffect, useState } from "react";
import { useSharedPortalStore } from "@/services/sharedPortalStore";

// تنظیمات عمومی صفحه اصلی به‌صورت مشترک روی سرور ذخیره می‌شوند.
export type Tile = {
  id: string; title: string; desc: string; href: string; icon: string; on: boolean; locked: boolean;
  image?: string; // data URL (SVG/PNG/WebP) جایگزین آیکون می‌شود
  titleColor?: string;
};
export type CardId = "calendar" | "birthday" | "hire" | "meal";
export type CardCfg = { id: CardId; title: string; titleColor?: string; text?: string; image?: string; on?: boolean };
export type Person = {
  id: string; kind: "birthday" | "hire"; name: string; unit: string;
  date: string; // birthday: "j:MM-DD" (شمسی؛ قدیمی بدون پیشوند = میلادی)  |  hire: "YYYY-MM-DD"
  photo?: string;
};
export type CalEvent = { id: string; date: string; title: string; holiday: boolean }; // date: YYYY-MM-DD میلادی
export type CalConfig = { sourceUrl: string; events: CalEvent[] };

export const defaultTiles: Tile[] = [
  { id: "cafe", title: "سامانه کافی‌شاپ و تغذیه", desc: "سفارش غذا و نوشیدنی", href: "/cafe", icon: "cafe", on: true, locked: true },
  { id: "att", title: "سامانه حضور و غیاب", desc: "ورود، خروج و مرخصی", href: "/hr/attendance", icon: "clock", on: true, locked: true },
  { id: "tickets", title: "سامانه تیکتینگ", desc: "ثبت و پیگیری درخواست‌ها", href: "/tickets", icon: "ticket", on: true, locked: true },
  { id: "auto", title: "اتوماسیون اداری", desc: "نامه‌ها و گردش کار", href: "/automation", icon: "mail", on: true, locked: true },
  { id: "erp", title: "سامانه ERP", desc: "مدیریت یکپارچه سازمان", href: "/erp", icon: "chart", on: true, locked: true },
  { id: "hr", title: "منابع انسانی", desc: "خدمات و درخواست‌های پرسنلی", href: "/hr", icon: "users", on: true, locked: true },
  { id: "documents", title: "سامانه مستندات", desc: "اسناد و مدارک سازمان", href: "/documents", icon: "doc", on: true, locked: true },
  { id: "phonebook", title: "دفترچه تلفن", desc: "شماره‌های تماس سازمان", href: "/phonebook", icon: "phone", on: true, locked: true },
];
export const defaultPeople: Person[] = [
  { id: "p1", kind: "birthday", name: "نام نمونه", unit: "واحد نمونه", date: "11-09" },
  { id: "p2", kind: "hire", name: "نام نمونه", unit: "واحد نمونه", date: new Date().toISOString().slice(0, 10) },
];
export const defaultCal: CalConfig = { sourceUrl: "", events: [] };
export const defaultCards: CardCfg[] = [
  { id: "calendar", title: "تقویم سازمان", text: "" },
  { id: "birthday", title: "تولد همکاران", text: "" },
  { id: "hire", title: "استخدام‌های جدید", text: "" },
  { id: "meal", title: "غذای روز", text: "", on: true },
];

/** تبدیل فایل به data URL؛ محدودیت حجم برای سقف localStorage */
export function fileToDataUrl(f: File, maxKB = 300): Promise<string> {
  if (f.size > maxKB * 1024) return Promise.reject(new Error(`حجم فایل بیش از ${maxKB} کیلوبایت است`));
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function useStore<T>(key: string, def: T) {
  const [v, setV] = useState<T>(def);
  useEffect(() => {
    const read = () => { try { const r = localStorage.getItem(key); if (r) setV(JSON.parse(r)); } catch {} };
    read();
    const on = (e: StorageEvent) => { if (e.key === key) read(); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, [key]);
  const save = useCallback((n: T) => {
    setV(n);
    try { localStorage.setItem(key, JSON.stringify(n)); } catch { alert("ذخیره نشد؛ حجم داده‌ها از سقف مرورگر بیشتر است. تصاویر کوچک‌تری انتخاب کنید."); }
  }, [key]);
  return [v, save] as const;
}

export const useSharedTiles = () => useSharedPortalStore<Tile[]>("tiles", defaultTiles);
export const useSharedCards = () => useSharedPortalStore<CardCfg[]>("cards", defaultCards);
export const useSharedCal = () => useSharedPortalStore<CalConfig>("calendar", defaultCal);
export const useTiles = () => { const s = useSharedTiles(); return [s.value, s.save] as const; };
export const usePeople = () => useStore<Person[]>("portal.people.v1", defaultPeople);
export const useCal = () => { const s = useSharedCal(); return [s.value, s.save] as const; };
export const useCards = () => { const s = useSharedCards(); return [s.value, s.save] as const; };

export const uid = () => Math.random().toString(36).slice(2, 9);

const tehranYMD = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(d); // YYYY-MM-DD

/** تولدهای امروز؛ اگر نبود، تولدهای ۷ روز آینده */
/** تولد: "j:MM-DD" یعنی ماه-روز شمسی (تکرار سالانه بر اساس تقویم شمسی). بدون پیشوند = قدیمی، ماه-روز میلادی. */
export function birthdayJalali(date: string, refGy: number) {
  if (date.startsWith("j:")) { const [m, d] = date.slice(2).split("-").map(Number); return { m, d }; }
  const [gm, gd] = date.split("-").map(Number);
  const j = toJalali(refGy, gm, gd);
  return { m: j.jm, d: j.jd };
}
export const birthdayKey = (m: number, d: number) => `j:${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function birthdaysToShow(people: Person[]) {
  const today = tehranYMD();
  const [gy, gm, gd] = today.split("-").map(Number);
  const tj = toJalali(gy, gm, gd);
  const t0 = Date.UTC(gy, gm - 1, gd);
  const b = people.filter((p) => p.kind === "birthday");
  // فاصله‌ی روزی تا نزدیک‌ترین تولد بعدی (۰ = امروز)
  const until = (p: Person) => {
    const { m, d } = birthdayJalali(p.date, gy);
    for (const y of [tj.jy, tj.jy + 1]) {
      const g = toGregorian(y, m, Math.min(d, jalaliMonthLength(y, m)));
      const diff = (Date.UTC(g.gy, g.gm - 1, g.gd) - t0) / 864e5;
      if (diff >= 0) return diff;
    }
    return Infinity;
  };
  const now = b.filter((p) => until(p) === 0);
  if (now.length) return { today: true, list: now };
  return { today: false, list: b.filter((p) => { const d = until(p); return d > 0 && d <= 7; }) };
}

export function recentHires(people: Person[], days = 30) {
  const t0 = new Date(tehranYMD()).getTime();
  return people.filter((p) => p.kind === "hire" && (t0 - new Date(p.date).getTime()) / 864e5 <= days && new Date(p.date).getTime() <= t0 + 864e5);
}

/** رویدادهای تقویم: دستی + منبع خارجی (JSON آرایه‌ای از {date,title,holiday}) */
export function useCalEvents(includePast = false, includeBuiltin = true) {
  const [cfg] = useCal();
  const [remote, setRemote] = useState<CalEvent[]>([]);
  useEffect(() => {
    if (!cfg.sourceUrl) { setRemote([]); return; }
    fetch(cfg.sourceUrl).then((r) => r.json()).then((a) => {
      if (Array.isArray(a)) setRemote(a.filter((x) => x?.date && x?.title).map((x, i) => ({ id: `r${i}`, date: String(x.date).slice(0, 10), title: String(x.title), holiday: !!x.holiday })));
    }).catch(() => setRemote([]));
  }, [cfg.sourceUrl]);
  const today = tehranYMD();
  return [...cfg.events, ...remote, ...(includeBuiltin ? builtinHolidays() : [])].filter((e) => includePast || e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

/** تعطیلات رسمی از time.ir (فایل src/data/jalali-events.json) برای سال‌های موجود */
function builtinHolidays(): CalEvent[] {
  const out: CalEvent[] = [];
  for (const [y, v] of Object.entries(eventData as Record<string, { events: { m: number; d: number; title: string; holiday: boolean }[] }>)) {
    v.events.filter((e) => e.holiday).forEach((e, i) => {
      const g = toGregorian(Number(y), e.m, e.d);
      out.push({ id: `t${y}-${i}`, date: `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`, title: e.title, holiday: true });
    });
  }
  return out;
}
