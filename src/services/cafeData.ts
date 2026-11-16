"use client";
import { useCallback, useEffect, useState } from "react";
import { toJalali } from "@/lib/jalali";

// داده‌ی نمونه‌ی کافی‌شاپ. با اتصال API فقط منبع داده عوض می‌شود.
export type Product = { id: string; name: string; price: number; category: string; description?: string; available?: boolean };
export type OrderLine = { productId: string; qty: number; price: number; name?: string };
export type Order = { id: string; date: string; lines: OrderLine[]; total: number; excess: number; code?: string; ts?: number; guest?: string; host?: string; cancelled?: boolean; reason?: string; edited?: boolean };
export type CafeMenuDay = { day: string; date: string; lunch: string; lunch2?: string; id1?: string; id2?: string; sideId1?: string; sideId2?: string; off?: boolean; today?: boolean; iso?: string };

export const MONTHLY_PACKAGE = 500_000; // بسته‌ی ماهانه (تومان)
export const MONTH_USED = 480_000; // مصرف تا امروز (نمونه)

export type Employee = { code: string; name: string; unit: string; used: number; locationId?: number | null; location?: string };
/** داده‌ی نمونه؛ فقط وقتی API کارکنان خالی باشد استفاده می‌شود */
const SAMPLE_EMPLOYEES: Employee[] = [
  { code: "10456", name: "نمونه کاربر", unit: "مدیریت سیستم", used: 0 },
  { code: "10457", name: "علی رضایی", unit: "معدن", used: 0 },
  { code: "10458", name: "مریم احمدی", unit: "مالی", used: 0 },
];
export type EmpSource = "hr" | "api";
/** لیست کارکنان از /api/cafe/employees (منبع: صفحه‌ی منابع انسانی یا API، طبق تنظیم استقرار) */
export function useEmployees() {
  const [list, setList] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  const [source, setSource] = useState<EmpSource>("hr");
  const [ready, setReady] = useState(false);
  const load = useCallback(() => fetch("/api/cafe/employees", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "دریافت کارکنان ممکن نشد."); return d; }).then((d) => {
    setError("");
    if (d?.source) setSource(d.source);
    setList(Array.isArray(d?.employees) ? d.employees.map((e: any) => ({ code: e.code, name: e.name, unit: e.unit ?? "", locationId: e.locationId, location: e.location, used: 0 })) : []);
  }).catch((e) => { setList([]); setError(e.message || "دریافت کارکنان ممکن نشد."); }).finally(() => setReady(true)), []);
  useEffect(() => { load(); }, [load]);
  /** فقط در حالت hr؛ ورودی: فهرست کامل کارکنان */
  const save = useCallback(async (next: { code: string; name: string; unit: string }[]) => {
    try {
      const res = await fetch("/api/cafe/employees", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (res.ok) await load();
      return res.ok;
    } catch { return false; }
  }, [load]);
  return { employees: list, source, ready, error, save, reload: load };
}
/** اعتبار ماهانه: مصرف فقط در ماه شمسی جاری حساب می‌شود و به ماه بعد منتقل نمی‌شود. */
const jMonthKey = (t: number) => { const d = new Date(t); const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate()); return `${j.jy}-${j.jm}`; };
export function usedOf(e: Employee, orders: Order[]) {
  const key = jMonthKey(Date.now());
  return e.used + orders.filter((o) => o.code === e.code && !o.guest && !o.cancelled && (!o.ts || jMonthKey(o.ts) === key)).reduce((s, o) => s + o.total - o.excess, 0);
}

/** گروه‌های اعتبار */
export type CreditGroup = { id: string; name: string; unlimited: boolean; amount: number };
export type Credit = { groups: CreditGroup[]; assign: Record<string, string>; override: Record<string, number> };
export const DEFAULT_GROUP_ID = "g-emp";
export const DEFAULT_CREDIT: Credit = {
  groups: [
    { id: "g-emp", name: "کارمندان", unlimited: false, amount: MONTHLY_PACKAGE },
    { id: "g-chief", name: "روسا", unlimited: false, amount: 700_000 },
    { id: "g-mgr", name: "مدیران", unlimited: true, amount: 0 },
  ],
  assign: {}, override: {},
};
export const groupOf = (c: Credit, code: string) =>
  c.groups.find((g) => g.id === (c.assign[code] ?? DEFAULT_GROUP_ID)) ?? c.groups[0];
/** سقف اعتبار ماهانه؛ Infinity یعنی نامحدود */
export function limitOf(c: Credit, code: string) {
  if (c.override[code] != null) return c.override[code];
  const g = groupOf(c, code);
  return g.unlimited ? Infinity : g.amount;
}
export const limStr = (n: number) => (n === Infinity ? "نامحدود" : n.toLocaleString("fa-IR"));

const CREDIT_API = "/api/cafe/credit";
export function useCredit() {
  const [credit, setCredit] = useState<Credit>(DEFAULT_CREDIT);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(CREDIT_API, { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return r.json(); }).then((d) => { if (!d?.groups?.length) throw new Error(); setCredit({ ...DEFAULT_CREDIT, ...d }); setError(""); }).catch(() => setError("تنظیمات اعتبار دریافت نشد." )).finally(() => setReady(true));
  }, []);
  /** هر تغییر بلافاصله ذخیره می‌شود */
  const save = useCallback(async (next: Credit) => {
    try { const ok = (await fetch(CREDIT_API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })).ok; if (ok) setCredit(next); return ok; } catch { return false; }
  }, []);
  return { credit, save, ready, error };
}

export const DEFAULT_PRODUCTS: Product[] = [
  { id: "p1", name: "چلوکباب کوبیده", price: 120_000, category: "غذا" },
  { id: "p2", name: "قیمه با برنج", price: 85_000, category: "غذا" },
  { id: "p3", name: "کتلت با پوره", price: 90_000, category: "غذا" },
  { id: "p4", name: "سالاد فصل", price: 25_000, category: "میان‌وعده" },
  { id: "p5", name: "ماست موسیر", price: 15_000, category: "میان‌وعده" },
  { id: "p6", name: "دسر فصل", price: 20_000, category: "میان‌وعده" },
  { id: "p7", name: "چای", price: 10_000, category: "نوشیدنی" },
  { id: "p8", name: "دوغ", price: 12_000, category: "نوشیدنی" },
];

export const DEFAULT_WEEK: CafeMenuDay[] = [
  { day: "شنبه", date: "۱۷", lunch: "قیمه با برنج", today: true },
  { day: "یکشنبه", date: "۱۸", lunch: "کتلت با پوره" },
  { day: "دوشنبه", date: "۱۹", lunch: "چلوکباب کوبیده" },
  { day: "سه‌شنبه", date: "۲۰", lunch: "خورشت بادمجان" },
  { day: "چهارشنبه", date: "۲۱", lunch: "عدسی با نان" },
  { day: "پنجشنبه", date: "۲۲", lunch: "تعطیل", off: true },
];

const API = "/api/cafe/orders";

/** سفارش‌ها؛ روی فایل سرور (data/cafe-orders.json) ذخیره می‌شوند. */
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const response = await fetch(API, { cache: "no-store" }); const data = await response.json(); if (!response.ok || !Array.isArray(data)) throw new Error(); setOrders(data); setError(""); } catch { setError("دریافت سفارش‌ها ممکن نشد."); } finally { setReady(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const add = useCallback(async (o: Order) => {
    setOrders((p) => [o, ...p]);
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
  }, []);
  const update = useCallback(async (id: string, patch: Partial<Order>) => {
    setOrders((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    await fetch(API, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, patch }) });
  }, []);
  return { orders, add, update, reload: load, ready, error };
}

export const DEFAULT_GROUPS = ["غذا", "میان‌وعده", "نوشیدنی"];
export type Side = { id: string; name: string; price: number };
export const DEFAULT_SIDES: Side[] = [
  { id: "s1", name: "سالاد", price: 0 },
  { id: "s2", name: "سوپ", price: 0 },
  { id: "s3", name: "ماست", price: 0 },
  { id: "s4", name: "ترشی", price: 0 },
];
/** شناسه‌ی ثابت غذا (برای امتیازدهی/انتخاب در آینده): از نام ساخته می‌شود و با تغییر نام همان می‌ماند. */
export const foodId = (name: string) => "f_" + Array.from(name.trim().replace(/\s+/g, " ")).reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
const withIds = (w: CafeMenuDay[]): CafeMenuDay[] => w.map((d) => ({
  ...d,
  id1: d.lunch ? d.id1 ?? foodId(d.lunch) : undefined,
  id2: d.lunch2 ? d.id2 ?? foodId(d.lunch2) : undefined,
}));
export type CafeMenu = { groups: string[]; products: Product[]; week: CafeMenuDay[]; sides?: Side[] };
const MENU_API = "/api/cafe/menu";

/** منو و برنامه‌ی هفته؛ روی فایل سرور (data/cafe-menu.json) ذخیره می‌شوند. */
export function useMenu() {
  const [menu, setMenu] = useState<CafeMenu>({ groups: DEFAULT_GROUPS, products: DEFAULT_PRODUCTS, week: DEFAULT_WEEK, sides: DEFAULT_SIDES });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(MENU_API, { cache: "no-store" }); if (!response.ok) throw new Error();
      const m = await response.json();
      if (!m || !Array.isArray(m.products)) throw new Error();
      setMenu({ groups: m.groups ?? [], products: m.products, week: m.week ?? [], sides: m.sides ?? [] }); setError("");
    } catch { setError("منوی کافی‌شاپ دریافت نشد."); } finally { setReady(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  /** ذخیره روی سرور؛ مقدار برگشتی: آیا با موفقیت ذخیره شد. */
  const save = useCallback(async (next: CafeMenu): Promise<boolean> => {
    next = { ...next, week: withIds(next.week) };
    try {
      const r = await fetch(MENU_API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (r.ok) setMenu(next);
      return r.ok;
    } catch { return false; }
  }, []);
  return { groups: menu.groups, products: menu.products, week: menu.week, sides: menu.sides ?? DEFAULT_SIDES, save, ready, error };
}
