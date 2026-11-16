"use client";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { PageFrame } from "@/components/PageFrame";
import { GroupPicker } from "@/components/GroupPicker";
import { Badge, Card, DataTable, Kpi, Note } from "@/components/ui";
import { useEmployees, usedOf, useCredit, limitOf, groupOf, limStr, type Credit, useMenu, useOrders, type CafeMenuDay, type Order, type Product, type Side } from "@/services/cafeData";
import "@/styles/cafe.css";
import "@/styles/cafe-manager.css";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { toJalali, toGregorian, jalaliMonths } from "@/lib/jalali";
import { isHoliday } from "@/lib/holidays";
import type { CafeMenu } from "@/services/cafeData";

const pad2 = (n: number) => String(n).padStart(2, "0");
const faDigits = (s: string) => s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));

// تاریخ هر روز را به شکل ISO میلادی می‌دهد؛ اگر ذخیره نشده باشد از عدد روز و ماه/سال جاری شمسی حدس می‌زند.
function dayIso(d: CafeMenuDay): string | undefined {
  if (d.iso) return d.iso;
  const m = faDigits(d.date || "").match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return undefined;
  const g = toGregorian(+m[1], +m[2], +m[3]);
  return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
}

// برچسب نمایشی تاریخ شمسی، مثل «۱۷ آبان ۱۴۰۵»
function isoLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const j = toJalali(y, m, d);
  return `${fa(j.jd)} ${jalaliMonths[j.jm - 1]} ${fa(j.jy)}`;
}

// آیا این تاریخ (ISO میلادی) تعطیل رسمی است؟
function isoOff(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const j = toJalali(y, m, d);
  return isHoliday(j.jy, j.jm, j.jd, (new Date(y, m - 1, d).getDay() + 1) % 7);
}
const shiftIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + days);
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
};
// تاریخ امروز به وقت محلی (نه UTC)
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`; };
// نام روز هفته‌ی یک تاریخ ISO میلادی، به فارسی
const FA_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const weekdayOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return FA_WEEKDAYS[new Date(y, m - 1, d).getDay()]; };

const fa = (n: number) => n.toLocaleString("fa-IR");
const fmt = (n: number) => fa(n) + " تومان";
// ورودی قیمت: ارقام انگلیسی با جداکننده‌ی هزارگان
const priceStr = (n: number) => (n ? n.toLocaleString("fa-IR") : "");
const parsePrice = (s: string) => Number(faDigits(s).replace(/[^\d]/g, "")) || 0;

export default function Page() {
  const { orders, ready: ordersReady, error: ordersError } = useOrders();
  const { employees, ready: employeesReady, error: employeesError } = useEmployees();
  const menu = useMenu();
  const products = menu.products;
  const [q, setQ] = useState("");
  const [creditStatus, setCreditStatus] = useState("all");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [orderDate, setOrderDate] = useState<string | undefined>();
  const live = orders.filter((o) => !o.cancelled);
  const today = new Date().toDateString();
  const td = live.filter((o) => o.ts && new Date(o.ts).toDateString() === today);
  const excess = live.reduce((s, o) => s + o.excess, 0);
  const guestSum = live.filter((o) => o.guest).reduce((s, o) => s + o.total, 0);
  const [tab, setTab] = useState<"orders" | "plan" | "menu" | "credit">("orders");
  const [pending, setPending] = useState<Partial<CafeMenu>>({});
  const [status, setStatus] = useState<"" | "ok" | "err">("");
  const [busy, setBusy] = useState(false);
  const isDirty = Object.keys(pending).length > 0;
  const onDraft = (p: Partial<CafeMenu>) => { setStatus(""); setPending((x) => ({ ...x, ...p })); };
  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);
  const saveAll = async () => {
    const groups = pending.groups ?? menu.groups;
    const prods = pending.products ?? menu.products;
    if (!menu.ready || menu.error || !groups.length || groups.some(g => !g.trim()) || new Set(groups.map(g => g.trim())).size !== groups.length || prods.some(p => !p.name.trim() || !groups.includes(p.category) || !Number.isSafeInteger(p.price) || p.price <= 0) || (pending.week && pending.week.some(d => !dayIso(d)))) { setStatus("err"); return; }
    setBusy(true);
    const ok = await menu.save({ groups, products: prods, week: pending.week ?? menu.week, sides: pending.sides ?? menu.sides });
    setBusy(false); setStatus(ok ? "ok" : "err");
    if (ok) setPending({});
  };
  const creditState = useCredit();
  const { credit, ready: creditReady, error: creditError } = creditState;
  const weekAgo = Date.now() - 7 * 86400000;
  const wk = live.filter((o) => o.ts && o.ts >= weekAgo);
  const ti = todayIso();
  const curWeek = pending.week ?? menu.week;
  const todayDay = curWeek.find((d) => dayIso(d) === ti);
  const todayEmpty = !todayDay || (!todayDay.off && !todayDay.lunch?.trim());
  const emptyDays = curWeek.filter((d) => !d.off && !d.lunch?.trim());
  const missingDates = curWeek.filter(d => !dayIso(d));
  // جستجوی زنده: بدون فاصله‌های اضافی و با تبدیل ارقام فارسی/عربی به لاتین
const normQ = q.trim().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\s+/g, " ");
const rows = employees.filter((e) => { const lim = limitOf(credit, e.code), remaining = Math.max(0, lim - usedOf(e, orders)); const status = lim === Infinity ? "unlimited" : remaining === 0 ? "empty" : remaining < lim * .1 ? "low" : "normal"; return (!normQ || e.name.includes(normQ) || e.code.includes(normQ)) && (creditStatus === "all" || status === creditStatus); });
  const filteredOrders = orders.filter(o => { const person = employees.find(e => e.code === o.code); const text = `${o.code ?? ""} ${person?.name ?? ""} ${o.guest ?? ""}`; const query = faDigits(orderQuery.trim()); const matchStatus = orderStatus === "all" || (orderStatus === "cancelled" ? o.cancelled : orderStatus === "guest" ? !!o.guest && !o.cancelled : orderStatus === "excess" ? o.excess > 0 && !o.cancelled : !o.cancelled); const date = o.ts ? new Date(o.ts) : null; const iso = date ? `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}` : ""; return (!query || faDigits(text).includes(query)) && matchStatus && (!orderDate || iso === orderDate); });
  return (
    <PageFrame id="cafe" title="مدیریت کافی‌شاپ" activeHref="/cafe/manager">
      <div className="cafe-manager"><div className="crumb crumb-dark">صفحه اصلی / کافی‌شاپ / مدیریت</div>
      <h2 className="cafe-h">مدیریت کافی‌شاپ</h2>
      <div className="cafe-today">
        <b>امروز:</b>{" "}
        {!menu.ready ? "در حال دریافت برنامه…" : menu.error ? "دریافت برنامه غذایی ممکن نشد." : todayDay?.off ? "تعطیل" : todayDay && !todayEmpty ? [todayDay.lunch, todayDay.lunch2].filter(Boolean).join(" • ") : <span className="cafe-warn"> ⚠ برنامه‌ی غذایی امروز خالی است. <button type="button" className="cafe-link" onClick={() => setTab("plan")}>ثبت در برنامه‌ی غذایی</button></span>}
        <span> — {ordersReady && !ordersError ? `${fa(td.length)} سفارش ثبت شده` : "وضعیت سفارش‌ها نامشخص"}</span>
      </div>
      <div className="ui-kpis">
        <Kpi label="سفارش‌های امروز" value={ordersReady && !ordersError ? fa(td.length) : "—"} />
        <Kpi label="جمع فروش امروز" value={ordersReady && !ordersError ? fmt(td.reduce((s, o) => s + o.total, 0)) : "—"} />
        <Kpi label="سفارش‌های ۷ روز اخیر" value={ordersReady && !ordersError ? fa(wk.length) : "—"} />
        <Kpi label="فروش ۷ روز اخیر" value={ordersReady && !ordersError ? fmt(wk.reduce((s, o) => s + o.total, 0)) : "—"} />
      </div>
      <div className="cafe-tabs" role="tablist">
        {([["orders", "سفارش‌ها و کارکنان"], ["plan", "برنامه‌ی غذایی"], ["menu", "منوی کافی‌شاپ"], ["credit", "اعتبار و گروه‌ها"]] as const).map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>
      <div hidden={tab !== "credit"}>
        <CreditCard creditState={creditState} />
      </div>
      <div hidden={tab !== "plan"}>
        {menu.ready && !menu.error ? <MealPlanCard week={menu.week} sides={menu.sides} onDraft={onDraft} /> : <div className="cm-error">{menu.error || "در حال دریافت برنامه…"}</div>}
      </div>
      <div hidden={tab !== "menu"}>
        {menu.ready && !menu.error ? <MenuCard groups={menu.groups} products={menu.products} orders={orders} ordersReady={ordersReady && !ordersError} onDraft={onDraft} /> : <div className="cm-error">{menu.error || "در حال دریافت منو…"}</div>}
      </div>
      <div className="cafe-orders cm-order-tab" hidden={tab !== "orders"}>
      {(ordersError || employeesError || creditError || menu.error) && <div className="cm-error" role="alert">{[ordersError, employeesError, creditError, menu.error].filter(Boolean).join(" · ")}</div>}
      <Card title="وضعیت بسته‌ی کارکنان" aside={`${fa(rows.length)} نفر`}>
        <div className="cm-employee-filters"><input className="cafe-guest-name" type="search" placeholder="جستجوی نام یا کد پرسنلی" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /><select aria-label="وضعیت اعتبار" value={creditStatus} onChange={e => setCreditStatus(e.target.value)}><option value="all">همه وضعیت‌های اعتبار</option><option value="normal">عادی</option><option value="low">اعتبار کم</option><option value="empty">تمام‌شده</option><option value="unlimited">نامحدود</option></select><button type="button" className="cm-reset" onClick={() => {setQ(""); setCreditStatus("all");}}>پاک کردن فیلترها</button></div>
        {!ordersReady || !employeesReady || !creditReady ? <p>در حال دریافت اطلاعات…</p> : ordersError || employeesError || creditError ? <p>اطلاعات اعتبار در دسترس نیست.</p> : <div className="cm-table-scroll"><DataTable columns={["کد پرسنلی", "نام و نام خانوادگی", "واحد", "مصرف", "مانده", "وضعیت"]} rows={rows.map((e) => {
          const u = usedOf(e, orders); const lim = limitOf(credit, e.code); const r = Math.max(0, lim - u);
          return [e.code, e.name, e.unit, fmt(u), lim === Infinity ? "نامحدود" : fmt(r), lim === Infinity ? <Badge tone="ok">نامحدود</Badge> : r === 0 ? <Badge tone="warn">تمام‌شده</Badge> : r < lim * 0.1 ? <Badge tone="info">کم</Badge> : <Badge tone="ok">عادی</Badge>];
        })} /></div>}
      </Card>
      <Card title="سفارش‌ها" aside={`${fa(filteredOrders.length)} سفارش`}>
        <div className="cm-filters"><input aria-label="جستجوی سفارش‌ها" placeholder="نام یا کد پرسنلی" value={orderQuery} onChange={e => setOrderQuery(e.target.value)}/><select aria-label="وضعیت سفارش" value={orderStatus} onChange={e => setOrderStatus(e.target.value)}><option value="all">همه وضعیت‌ها</option><option value="active">ثبت‌شده</option><option value="excess">دارای مازاد</option><option value="guest">مهمان</option><option value="cancelled">لغوشده</option></select><JalaliDateInput label="تاریخ سفارش" value={orderDate} onChange={setOrderDate}/><button type="button" className="cm-reset" onClick={() => {setOrderQuery(""); setOrderStatus("all"); setOrderDate(undefined);}}>پاک کردن فیلترها</button></div>
        {!ordersReady ? <p>در حال دریافت سفارش‌ها…</p> : ordersError ? <p>{ordersError}</p> : !filteredOrders.length ? <p>سفارشی در این محدوده پیدا نشد.</p> : <div className="cm-table-scroll"><DataTable columns={["تاریخ", "کارمند / کد", "اقلام", "مبلغ", "وضعیت"]} rows={filteredOrders.map((o) => [
          o.date, `${employees.find(e => e.code === o.code)?.name || "نام در دسترس نیست"} · ${o.code ?? "-"}`,
          o.lines.map((l) => `${l.name || products.find((p) => p.id === l.productId)?.name || "قلم قبلی"} × ${fa(l.qty)}`).join("، "),
          fmt(o.total),
          o.cancelled ? <Badge tone="warn">لغو: {o.reason}</Badge> : o.guest ? <Badge tone="info">مهمان: {o.guest}</Badge> : o.excess > 0 ? <span className="cm-excess">مازاد {fmt(o.excess)}</span> : <Badge tone="ok">در بسته</Badge>,
        ])} /></div>}
      </Card>
      </div>
      {(isDirty || status || tab === "plan") && (
        <div className={`cafe-savebar${isDirty ? " is-dirty" : ""}`}>
          {isDirty && <span className="cafe-dirty">تغییرات ذخیره‌نشده دارید</span>}
          {tab === "plan" && (missingDates.length ? <span className="cafe-warn">⚠ تاریخ کامل {fa(missingDates.length)} روز ثبت نشده است؛ تاریخ‌ها را انتخاب کنید.</span> : emptyDays.length ? <span className="cafe-warn">⚠ {fa(emptyDays.length)} روز بدون غذا: {emptyDays.map((d) => d.day || d.date).join("، ")}</span> : <span className="cafe-save-msg ok">✓ همه‌ی روزهای غیرتعطیل ثبت شده‌اند</span>)}
          <SaveStatus state={status} />
          {isDirty && <Button variant="primary" disabled={busy} onClick={saveAll}>{busy ? "در حال ذخیره…" : "ذخیره‌ی همه‌ی تغییرات"}</Button>}
        </div>
      )}
      </div></PageFrame>
  );
}


function SideSel({ v, sides, on }: { v?: string; sides: Side[]; on: (v: string | undefined) => void }) {
  return (
    <select className="cafe-side-sel" aria-label="همراه غذا" value={sides.some((x) => x.id === v) ? v : ""} onChange={(e) => on(e.target.value || undefined)}>
      <option value="">بدون همراه</option>
      {sides.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  );
}

function SaveStatus({ state }: { state: "" | "ok" | "err" }) {
  if (!state) return null;
  return state === "ok"
    ? <span className="cafe-save-msg ok">✓ با موفقیت روی سرور ذخیره شد</span>
    : <span className="cafe-save-msg err" role="alert">✕ ذخیره نشد؛ نام، قیمت، گروه و تاریخ کامل روزها و اتصال به سرور را بررسی کنید.</span>;
}

function MealPlanCard({ week, sides, onDraft }: { week: CafeMenuDay[]; sides: Side[]; onDraft: (p: Partial<CafeMenu>) => void }) {
  const [draft, setDraft] = useState<CafeMenuDay[]>(week);
  useEffect(() => setDraft(week), [week]);
  const [sd, setSd] = useState<Side[]>(sides);
  useEffect(() => setSd(sides), [sides]);
  const [nw, setNw] = useState({ name: "", price: "" });
  const setSide = (id: string, patch: Partial<Side>) => { setSaved(""); setSd((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x))); };
  const addSide = () => {
    const name = nw.name.trim();
    if (!name) return;
    setSaved(""); setSd((d) => [...d, { id: "s" + Date.now(), name, price: 0 }]); setNw({ name: "", price: "" });
  };
  const [saved, setSaved] = useState<"" | "ok" | "err">("");
  useEffect(() => { if (draft !== week || sd !== sides) onDraft({ week: draft, sides: sd }); }, [draft, sd]); // eslint-disable-line react-hooks/exhaustive-deps
  const copyNext = () => {
    if (draft.some(d => !dayIso(d))) { setSaved("err"); return; }
    if (!window.confirm("غذاها حفظ می‌شود و تاریخ همه‌ی روزها ۷ روز جلو می‌رود. ادامه؟")) return;
    setSaved("");
    setDraft((d) => d.map((x) => {
      const iso = dayIso(x);
      if (!iso) return x;
      const n = shiftIso(iso, 7);
      return { ...x, iso: n, day: weekdayOf(n), date: isoLabel(n), off: isoOff(n) };
    }));
  };
  const set = (i: number, patch: Partial<CafeMenuDay>) => { setSaved(""); setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x))); };
  return (
    <Card title="برنامه‌ی غذایی هفته" aside={"نمایش در پورتال"}>
      <div className="cafe-copy"><Button size="sm" disabled={draft.some(d => !dayIso(d))} onClick={copyNext}>کپی برنامه به هفته‌ی بعد</Button><span>{draft.some(d => !dayIso(d)) ? "برای کپی، ابتدا تاریخ همه روزها را انتخاب کنید." : "تعطیلی روزها بر اساس تقویم رسمی خودکار تنظیم می‌شود."}</span></div>
      <div className="cafe-plan">
      <div className="cafe-week">
        <div className="cafe-week-row cafe-week-head">
          <span>روز</span><span>تاریخ (شمسی)</span><span>غذای اصلی و همراه آن</span><span>تعطیل</span>
        </div>
        {draft.map((d, i) => (
          <div key={i} className={"cafe-week-row" + (d.off ? " is-off" : "")}>
            <input aria-label="روز" value={d.day} onChange={(e) => set(i, { day: e.target.value })} />
            <JalaliDateInput label="تاریخ" value={dayIso(d)} onChange={(v) => set(i, v ? { iso: v, day: weekdayOf(v), date: isoLabel(v), off: isoOff(v) } : { iso: undefined, date: "" })} />
            <div className="cafe-week-meals">
              <div className="cafe-meal">
                <input aria-label="غذای اول" value={d.lunch} disabled={!!d.off} onChange={(e) => set(i, { lunch: e.target.value })} />
                {!d.off && <SideSel v={d.sideId1} sides={sd} on={(v) => set(i, { sideId1: v })} />}
                {!d.off && d.lunch2 === undefined && <Button size="sm" onClick={() => set(i, { lunch2: "" })}>+ غذای دوم</Button>}
              </div>
              {d.lunch2 !== undefined && !d.off && (
                <div className="cafe-meal">
                  <input aria-label="غذای دوم" placeholder="غذای دوم" value={d.lunch2} onChange={(e) => set(i, { lunch2: e.target.value })} />
                  <SideSel v={d.sideId2} sides={sd} on={(v) => set(i, { sideId2: v })} />
                  <Button variant="danger" size="sm" onClick={() => set(i, { lunch2: undefined })}>×</Button>
                </div>
              )}
            </div>
            <label className="cafe-week-off"><input type="checkbox" checked={!!d.off} onChange={(e) => set(i, { off: e.target.checked })} /></label>
          </div>
        ))}
      </div>
      <aside className="cafe-sides">
        <h4 className="cafe-sub">همراه غذا (سالاد، سوپ، ماست، ترشی …)</h4>
        <div className="cafe-side-list">
          {sd.map((x) => (
            <div key={x.id} className="cafe-side-row">
              <input aria-label="نام" value={x.name} onChange={(e) => setSide(x.id, { name: e.target.value })} />
              <Button variant="danger" size="sm" onClick={() => { setSaved(""); setSd((d) => d.filter((y) => y.id !== x.id)); }}>حذف</Button>
            </div>
          ))}
          <div className="cafe-side-row cafe-side-new">
            <input aria-label="نام مورد جدید" placeholder="مورد جدید" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
            <Button size="sm" onClick={addSide}>افزودن</Button>
          </div>
        </div>
      </aside>
      </div>
    </Card>
  );
}

function MenuCard({ groups, products, orders, ordersReady, onDraft }: { groups: string[]; products: Product[]; orders: Order[]; ordersReady: boolean; onDraft: (p: Partial<CafeMenu>) => void }) {
  const [gDraft, setGDraft] = useState<string[]>(groups);
  const [draft, setDraft] = useState<Product[]>(products);
  const [saved, setSaved] = useState<"" | "ok" | "err">("");
  const [newGroup, setNewGroup] = useState("");
  const [search, setSearch] = useState("");
  const [menuNotice, setMenuNotice] = useState("");
  useEffect(() => { if (gDraft !== groups || draft !== products) onDraft({ groups: gDraft, products: draft }); }, [gDraft, draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const [nw, setNw] = useState({ name: "", price: "", category: groups[0] ?? "", description: "" });
  useEffect(() => setGDraft(groups), [groups]);
  useEffect(() => setDraft(products), [products]);
  useEffect(() => setNw((n) => ({ ...n, category: groups.includes(n.category) ? n.category : groups[0] || "" })), [groups]);
  const dirty = () => setSaved("");

  const renameGroup = (i: number, name: string) => {
    dirty();
    const old = gDraft[i];
    setGDraft((g) => g.map((x, j) => (j === i ? name : x)));
    setDraft((d) => d.map((p) => (p.category === old ? { ...p, category: name } : p)));
  };
  const addGroup = () => {
    const name = newGroup.trim();
    if (!name || gDraft.includes(name)) return;
    dirty(); setGDraft((g) => [...g, name]); setNewGroup("");
  };
  const delGroup = (name: string) => {
    if (gDraft.length <= 1) return;
    const used = draft.filter((p) => p.category === name).length;
    if (used && !window.confirm(`${fa(used)} قلم در این گروه است. با حذف گروه، این اقلام به گروه اول منتقل می‌شوند. ادامه؟`)) return;
    dirty();
    const first = gDraft.find((g) => g !== name)!;
    setGDraft((g) => g.filter((x) => x !== name));
    setDraft((d) => d.map((p) => (p.category === name ? { ...p, category: first } : p)));
  };
  const set = (id: string, patch: Partial<Product>) => { dirty(); setDraft((d) => d.map((p) => (p.id === id ? { ...p, ...patch } : p))); };
  const del = (id: string) => { if (!ordersReady) { setMenuNotice("برای حذف محصول باید اطلاعات سفارش‌ها در دسترس باشد."); return; } if (orders.some(o => o.lines.some(l => l.productId === id))) { setMenuNotice("این محصول سابقه سفارش دارد؛ برای حفظ سوابق، آن را ناموجود کنید."); return; } setMenuNotice(""); dirty(); setDraft((d) => d.filter((p) => p.id !== id)); };
  const add = () => {
    const price = parsePrice(nw.price);
    if (!nw.name.trim() || !price || !nw.category) return;
    dirty();
    setDraft((d) => [...d, { id: "p" + Date.now(), name: nw.name.trim(), price, category: nw.category, description: nw.description.trim() }]);
    setNw({ ...nw, name: "", price: "", description: "" });
  };
  return (
    <Card title="مدیریت منوی کافی‌شاپ" aside={`${fa(draft.length)} قلم`}>
      <div className="cafe-menu-sec cm-groups-section">
        <div className="cm-section-heading"><div><h4 className="cafe-sub">دسته‌بندی محصولات</h4><p>نام دسته‌ها را ویرایش کنید یا دسته جدید بسازید.</p></div><span>{fa(gDraft.length)} دسته</span></div>
        <div className="cafe-menu-list cm-group-list">
          {gDraft.map((g, i) => (
            <div key={i} className="cafe-menu-row cafe-menu-grp">
              <input aria-label="نام گروه" value={g} onChange={(e) => renameGroup(i, e.target.value)} />
              <Button variant="danger" size="sm" onClick={() => delGroup(g)}>حذف گروه</Button>
            </div>
          ))}
          <div className="cafe-menu-row cafe-menu-grp">
            <input aria-label="نام گروه جدید" placeholder="نام گروه جدید" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
            <Button size="sm" onClick={addGroup}>افزودن گروه</Button>
          </div>
        </div>
      </div>

      <div className="cafe-menu-sec cm-products-section">
        <div className="cm-section-heading"><div><h4 className="cafe-sub">محصولات کافی‌شاپ</h4><p>برای ویرایش محصولات، دسته موردنظر را باز کنید.</p></div><span>{fa(draft.length)} محصول</span></div>
        <input className="cafe-guest-name cm-menu-search" aria-label="جستجوی محصولات" placeholder="جستجوی نام محصول" value={search} onChange={e => setSearch(e.target.value)} />
        {menuNotice && <p className="cm-error" role="alert">{menuNotice}</p>}
        {gDraft.map(group => { const items = draft.filter(p => p.category === group && p.name.includes(search.trim())); return items.length ? <details className="cm-category" key={group} open={search.trim() ? true : undefined}><summary>{group} <small>{fa(items.length)} محصول</small></summary><div className="cafe-menu-list">
          {items.map((p) => (
            <div key={p.id} className="cafe-menu-row cafe-menu-item">
              <input aria-label="نام قلم" value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} />
              <input aria-label="قیمت" inputMode="numeric" dir="ltr" value={priceStr(p.price)} onChange={(e) => set(p.id, { price: parsePrice(e.target.value) })} />
              <GroupPicker label="گروه قلم" value={p.category} options={gDraft} onChange={(v) => set(p.id, { category: v })} />
              <Button variant="danger" size="sm" onClick={() => del(p.id)}>حذف</Button>
              <label className="cm-availability"><input type="checkbox" checked={p.available !== false} onChange={e => set(p.id, { available: e.target.checked })} /> {p.available === false ? "ناموجود" : "موجود"}</label>
              <input className="cafe-product-description" aria-label={`توضیحات ${p.name}`} placeholder="توضیحات اختیاری؛ مثلاً مواد تشکیل‌دهنده یا کالری تقریبی" value={p.description ?? ""} onChange={(e) => set(p.id, { description: e.target.value })} maxLength={240} />
            </div>
          ))}
        </div></details> : null; })}
        {!draft.some(p => p.name.includes(search.trim())) && <p>محصولی پیدا نشد.</p>}
        <div className="cafe-menu-row cafe-menu-item cafe-menu-new">
          <input aria-label="نام قلم جدید" placeholder="نام قلم جدید" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
          <input aria-label="قیمت قلم جدید" placeholder="قیمت" inputMode="numeric" dir="ltr" value={nw.price} onChange={(e) => setNw({ ...nw, price: priceStr(parsePrice(e.target.value)) })} />
          <GroupPicker label="گروه قلم جدید" value={nw.category} options={gDraft} onChange={(v) => setNw({ ...nw, category: v })} />
          <Button size="sm" onClick={add}>افزودن</Button>
          <input className="cafe-product-description" aria-label="توضیحات قلم جدید" placeholder="توضیحات اختیاری محصول" value={nw.description} onChange={(e) => setNw({ ...nw, description: e.target.value })} maxLength={240} />
        </div>
      </div>

    </Card>
  );
}

/** تعریف گروه‌های اعتبار و تخصیص کارکنان؛ هر تغییر بلافاصله ذخیره می‌شود. */
function CreditCard({ creditState }: { creditState: ReturnType<typeof useCredit> }) {
  const { employees, ready: employeesReady, error: employeesError } = useEmployees();
  const { credit, save, ready, error } = creditState;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [bulk, setBulk] = useState("");
  const commit = async (n: Credit) => { if (busy || error) return; setBusy(true); setMsg("در حال ذخیره…"); setMsg((await save(n)) ? "✓ ذخیره شد" : "⚠ ذخیره نشد؛ دوباره تلاش کنید"); setBusy(false); };
  const setG = (id: string, patch: Partial<Credit["groups"][number]>) => commit({ ...credit, groups: credit.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const addG = () => commit({ ...credit, groups: [...credit.groups, { id: "g" + Date.now(), name: "گروه جدید", unlimited: false, amount: 500_000 }] });
  const delG = (id: string) => {
    if (id === "g-emp" || credit.groups.length < 2) return;
    const affected = employees.filter(e => groupOf(credit, e.code).id === id).length;
    if (!window.confirm(`با حذف این گروه، ${fa(affected)} نفر به گروه پیش‌فرض منتقل می‌شوند. ادامه می‌دهید؟`)) return;
    const assign = Object.fromEntries(Object.entries(credit.assign).filter(([, v]) => v !== id));
    commit({ ...credit, groups: credit.groups.filter((g) => g.id !== id), assign });
  };
  const assignTo = (codes: string[], gid: string) => {
    const assign = { ...credit.assign }; codes.forEach((c) => { assign[c] = gid; });
    commit({ ...credit, assign });
  };
  const setOv = (code: string, v: string) => {
    const override = { ...credit.override }; const n = parsePrice(v);
    if (!v.trim() || !n) delete override[code]; else override[code] = n;
    commit({ ...credit, override });
  };
  const nq = q.trim().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\s+/g, " ");
  const list = employees.filter((e) => !nq || e.name.includes(nq) || e.code.includes(nq) || groupOf(credit, e.code).name.includes(nq));
  const toggle = (c: string) => setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  return (
    <div className="cafe-orders">
      {(!ready || !employeesReady) ? <div className="cm-error">در حال دریافت اطلاعات اعتبار و کارکنان…</div> : (error || employeesError) ? <div className="cm-error" role="alert">{error || employeesError}</div> : <fieldset disabled={busy} className="cm-credit-fields">
      <Card title="گروه‌های اعتبار" aside={<span className="cafe-save-msg">{ready ? msg : "در حال بارگذاری…"}</span>}>
        <div className="cm-table-scroll cm-group-table"><DataTable columns={["نام گروه", "نوع اعتبار", "سقف ماهانه (تومان)", "تعداد افراد", ""]} rows={credit.groups.map((g) => [
          <input key="n" className="cafe-guest-name" defaultValue={g.name} onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && setG(g.id, { name: e.target.value.trim() })} />,
          <select key="t" className="cafe-guest-name" value={g.unlimited ? "u" : "m"} onChange={(e) => setG(g.id, { unlimited: e.target.value === "u" })}>
            <option value="m">ماهانه با سقف</option><option value="u">نامحدود / رایگان</option>
          </select>,
          g.unlimited ? "—" : <input key="a" className="cafe-guest-name" inputMode="numeric" defaultValue={priceStr(g.amount)} onBlur={(e) => setG(g.id, { amount: parsePrice(e.target.value) })} />,
          fa(employees.filter((e) => groupOf(credit, e.code).id === g.id).length),
          g.id === "g-emp" ? <Badge key="d" tone="info">پیش‌فرض</Badge> : <Button key="x" size="sm" variant="danger" onClick={() => delG(g.id)}>حذف</Button>,
        ])} /></div>
        <Button onClick={addG}>+ گروه جدید</Button>
        <Note>اعتبار ماهانه است و به ماه بعد منتقل نمی‌شود (نه مانده و نه بدهی). همه‌ی افراد در ابتدا در گروه «کارمندان» هستند.</Note>
      </Card>
      <Card title="تخصیص کارکنان به گروه">
        <input className="cafe-guest-name" type="search" placeholder="جستجوی نام، کد پرسنلی یا گروه" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <div className="rep-actions">
          <select className="cafe-guest-name" value={bulk} onChange={(e) => setBulk(e.target.value)}>
            <option value="">انتقال انتخاب‌شده‌ها به…</option>{credit.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <Button variant="primary" disabled={!bulk || !sel.length} onClick={() => { assignTo(sel, bulk); setSel([]); setBulk(""); }}>اعمال ({fa(sel.length)})</Button>
        </div>
        <div className="cm-table-scroll"><DataTable columns={["", "کد پرسنلی", "نام و نام خانوادگی", "واحد", "گروه", "اعتبار اختصاصی", "سقف نهایی"]} rows={list.map((e) => [
          <input key="c" type="checkbox" checked={sel.includes(e.code)} onChange={() => toggle(e.code)} />,
          e.code, e.name, e.unit,
          <select key="g" className="cafe-guest-name" value={groupOf(credit, e.code).id} onChange={(ev) => assignTo([e.code], ev.target.value)}>
            {credit.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>,
          <input key={e.code + (credit.override[e.code] ?? "")} className="cafe-guest-name" inputMode="numeric" placeholder="—" defaultValue={credit.override[e.code] != null ? priceStr(credit.override[e.code]) : ""} onBlur={(ev) => setOv(e.code, ev.target.value)} />,
          limStr(limitOf(credit, e.code)),
        ])} /></div>
        <Note>فهرست کارکنان از همان منبع پرسنلی پورتال خوانده می‌شود. فقط گروه و سقف کافی‌شاپ اینجا نگه‌داری می‌شود.</Note>
      </Card>
      </fieldset>}
    </div>
  );
}
