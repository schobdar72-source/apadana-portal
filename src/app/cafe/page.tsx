"use client";
import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "@/components/PageFrame";
import { limitOf, usedOf, type CafeMenu, type Credit, type Order } from "@/services/cafeData";
import { useMe } from "@/services/useMe";
import { toJalali, toGregorian, jalaliMonths } from "@/lib/jalali";
import "@/styles/cafe.css";
import "@/styles/cafe-home.css";

const fa = (n: number) => n.toLocaleString("fa-IR");
const money = (n: number) => `${fa(n)} تومان`;
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const digit = (s: string) => s.replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
const categoryIcon = (name: string) => name === "نوشیدنی گرم" ? "☕" : name === "نوشیدنی سرد" ? "🥤" : name === "دسر" ? "🍨" : name === "کیک‌ها" ? "🍰" : "•";
type Load<T> = { status: "loading" | "ok" | "empty" | "error"; value: T | null };
const initial = <T,>(): Load<T> => ({ status: "loading", value: null });

export default function Page() {
  const user = useMe();
  const [menu, setMenu] = useState<Load<CafeMenu>>(initial);
  const [credit, setCredit] = useState<Load<Credit>>(initial);
  const [orders, setOrders] = useState<Load<Order[]>>(initial);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("current");
  useEffect(() => {
    let live = true;
    const get = async <T,>(url: string, set: (v: Load<T>) => void) => {
      try { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(); const value = await r.json() as T | null; if (live) set({ status: value === null ? "empty" : "ok", value }); }
      catch { if (live) set({ status: "error", value: null }); }
    };
    void get<CafeMenu>("/api/cafe/menu", setMenu); void get<Credit>("/api/cafe/credit", setCredit); void get<Order[]>("/api/cafe/orders", setOrders);
    return () => { live = false; };
  }, []);
  const today = isoToday();
  const todayDate = new Date();
  const j = toJalali(todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate.getDate());
  const dateOf = (d: { iso?: string; date: string }) => {
    if (d.iso) return d.iso;
    // A day number without a month or year cannot safely identify a date.
    const parts = digit(d.date || "").match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!parts) return "";
    const g = toGregorian(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
  };
  const week = menu.value?.week ?? [];
  const todayMeal = week.find(d => dateOf(d) === today);
  const meal = (name?: string, sideId?: string) => { if (!name?.trim()) return ""; const side = menu.value?.sides?.find(s => s.id === sideId)?.name; return side ? `${name} · ${side}` : name; };
  const own = useMemo(() => user ? (orders.value ?? []).filter(o => o.code === user.code).sort((a,b) => (b.ts ?? 0) - (a.ts ?? 0)) : [], [orders.value, user]);
  const currentOrders = own.filter(o => { if (!o.ts) return false; const d = new Date(o.ts), x = toJalali(d.getFullYear(), d.getMonth()+1, d.getDate()); return x.jy === j.jy && x.jm === j.jm; });
  const displayed = period === "current" ? currentOrders : own;
  const validCredit = credit.status === "ok" && !!credit.value?.groups?.length && !!user && orders.status === "ok";
  const limit = validCredit ? limitOf(credit.value!, user!.code) : 0;
  const used = validCredit ? usedOf({code:user!.code,name:"",unit:"",used:0}, own) : 0;
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit-used);
  const monthExcess = limit === Infinity ? 0 : own.filter(o => !o.cancelled && !o.guest && (!o.ts || currentOrders.includes(o))).reduce((sum, o) => sum + o.excess, 0);
  const percent = limit > 0 && limit !== Infinity ? Math.min(100, Math.round(100*used/limit)) : 0;
  const groups = (menu.value?.groups ?? []).filter(g => g !== "اقلام قبلی");
  const products = (menu.value?.products ?? []).filter(p => groups.includes(p.category) && p.available !== false && (!category || p.category === category) && p.name.includes(query.trim()));
  const issue = (status: Load<unknown>["status"], empty: string) => status === "loading" ? "در حال دریافت اطلاعات…" : status === "error" ? "دریافت اطلاعات ممکن نشد؛ صفحه را دوباره بارگذاری کنید." : empty;
  return <PageFrame id="cafe" title="سامانه کافی‌شاپ و تغذیه" activeHref="/cafe"><div className="cf-home">
    <header className="cf-heading"><div><h1>کافی‌شاپ و تغذیه</h1><p>برنامه غذایی، اعتبار و سفارش‌های ثبت‌شده برای شما</p></div><span>ثبت سفارش توسط همکاران کافی‌شاپ انجام می‌شود</span></header>
    <section className="cf-card cf-credit"><div className="cf-section-head"><div><h2>اعتبار ماهانه من</h2><p>{jalaliMonths[j.jm-1]} {j.jy.toLocaleString("fa-IR", {useGrouping:false})} · مانده به ماه بعد منتقل نمی‌شود.</p></div></div>
      {!validCredit ? <p className="cf-notice">{orders.status !== "ok" ? issue(orders.status, "سفارش‌ها در دسترس نیستند.") : issue(credit.status, "اعتبار شما هنوز تنظیم نشده است.")}</p> : <><div className="cf-credit-stats"><div><span>سقف بسته</span><strong>{limit === Infinity ? "نامحدود" : money(limit)}</strong></div><div><span>مصرف‌شده</span><strong>{money(used)}</strong></div><div><span>مانده</span><strong>{remaining === Infinity ? "نامحدود" : money(remaining)}</strong></div></div>{limit !== Infinity && <><div className={`cf-progress${monthExcess > 0 ? " over-limit" : percent >= 80 ? " warning" : ""}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="میزان مصرف اعتبار"><span style={{width:`${percent}%`}}/></div><p className={`cf-progress-label${monthExcess > 0 ? " over-limit" : ""}`}>{monthExcess > 0 && <b>{"مازاد ماه جاری: "}{money(monthExcess)} {"· "}</b>}{fa(percent)}٪ از اعتبار مصرف شده است{percent >= 80 ? " · اعتبار شما رو به پایان است" : ""}</p></>}</>}
    </section>
    <section className="cf-card"><div className="cf-section-head"><div><h2>برنامه غذایی هفته</h2><p>غذای امروز و برنامه روزهای دیگر در یک نگاه</p></div></div>{menu.status !== "ok" ? <p className="cf-notice">{issue(menu.status,"برنامه غذایی هنوز ثبت نشده است.")}</p> : <><div className="cf-today"><div><span>غذای امروز · {todayDate.toLocaleDateString("fa-IR",{weekday:"long",day:"numeric",month:"long"})}</span><strong>{todayMeal ? todayMeal.off ? "تعطیل" : [meal(todayMeal.lunch,todayMeal.sideId1),meal(todayMeal.lunch2,todayMeal.sideId2)].filter(Boolean).join(" / ") || "برای امروز غذایی ثبت نشده است" : "برنامه‌ای برای تاریخ امروز ثبت نشده است"}</strong></div></div>{week.length > 0 && <div className="cf-week">{week.map((d,i) => <div className={`cf-day${dateOf(d) === today ? " is-today" : ""}`} key={d.iso || i}><b>{d.day} {d.date}{dateOf(d) === today && " · امروز"}</b><span>{d.off ? "تعطیل" : [meal(d.lunch,d.sideId1),meal(d.lunch2,d.sideId2)].filter(Boolean).join(" / ") || "غذا ثبت نشده"}</span></div>)}</div>}{week.some(d=>!dateOf(d)) && <p className="cf-subtle">تاریخ بعضی روزها کامل نیست؛ برای تشخیص غذای امروز باید برنامه مجدداً ثبت شود.</p>}</>}</section>
    <section className="cf-card cf-menu-card"><div className="cf-section-head"><div><h2>منوی کافی‌شاپ</h2><p>قیمت‌ها و توضیحات قابل ویرایش‌اند؛ کالری‌های فعلی نمونه و تقریبی هستند.</p></div></div>{menu.status !== "ok" ? <p className="cf-notice">{issue(menu.status,"منو هنوز ثبت نشده است.")}</p> : <><div className="cf-controls"><label>جست‌وجوی منو<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام محصول کافی‌شاپ"/></label><label>دسته‌بندی<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">همه دسته‌ها</option>{groups.map(g=><option key={g}>{g}</option>)}</select></label></div>{groups.filter(g=>products.some(p=>p.category===g)).map(g=><div className="cf-menu-group" key={g}><h3><span className="cf-category-icon" aria-hidden="true">{categoryIcon(g)}</span>{g}</h3><div className="cf-products">{products.filter(p=>p.category===g).map(p=><div key={p.id}><span><b>{p.name}</b>{p.description?.trim() && <small>{p.description}</small>}</span><strong>{money(p.price)}</strong></div>)}</div></div>)}{products.length === 0 && <p className="cf-notice">قلمی برای نمایش پیدا نشد.</p>}</>}</section>
    <section className="cf-card"><div className="cf-section-head"><div><h2>سفارش‌های من</h2><p>مبالغ ثبت‌شده توسط کافی‌شاپ</p></div><label className="cf-period">بازه نمایش<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="current">ماه جاری</option><option value="all">همه سفارش‌ها</option></select></label></div>{orders.status !== "ok" ? <p className="cf-notice">{issue(orders.status,"سفارشی ثبت نشده است.")}</p> : displayed.length === 0 ? <p className="cf-notice">در این بازه سفارشی برای شما ثبت نشده است.</p> : <div className="cf-order-list">{displayed.map(o=><article key={o.id}><div className="cf-order-top"><strong>{o.ts ? new Date(o.ts).toLocaleString("fa-IR") : o.date || "تاریخ ثبت نشده"}</strong><span className={`cf-status${o.cancelled ? " cancelled" : ""}`}>{o.cancelled ? "لغوشده" : o.guest ? "سفارش مهمان" : "ثبت‌شده"}</span></div><p>{o.lines?.map(l=>`${menu.value?.products?.find(p=>p.id===l.productId)?.name || "قلم ثبت‌شده"} × ${fa(l.qty)}`).join("، ") || "جزئیات اقلام موجود نیست"}</p><div className="cf-order-money"><span>مبلغ: <b>{money(o.total)}</b></span>{!o.guest && <><span>سهم بسته: <b>{money(Math.max(0,o.total-o.excess))}</b></span><span className={!o.cancelled && o.excess > 0 ? "cf-excess" : undefined}>مازاد: <b>{money(o.excess)}</b></span></>}{o.guest && <span>مهمان: {o.guest}</span>}</div>{o.cancelled && o.reason && <small>دلیل لغو: {o.reason}</small>}</article>)}</div>}</section>
  </div></PageFrame>;
}
