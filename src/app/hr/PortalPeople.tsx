"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { PageFrame } from "@/components/PageFrame";
import { Badge, Button, Card, Input, Note } from "@/components/ui";
import { useCards } from "@/services/portalData";
import BirthdayInsights, { type BirthdayInsightsData } from "./BirthdayInsights";
import "@/styles/portal-people.css";

type Row = { id: number; name: string; unit: string; unitId: number | null; title: string; locationId: number | null; location: string; days: number; label: string; photo?: string | null };
type Data = { rows: Row[]; cfg: { locs: number[]; hidden: number[]; approved: number[]; mode: "all" | "approved"; days: number; text: string; todayText: string; hirePeriod?: "days" | "month" }; max: number; defaults: { text: string; todayText: string }; locations: { id: number; name: string }[] };

const relTxt = (kind: "birthday" | "hire", days: number) => {
  if (days === 0) return "امروز";
  if (days === 1) return kind === "birthday" ? "فردا" : "دیروز";
  return kind === "birthday" ? `${days} روز دیگر` : `${days} روز پیش`;
};
const sameText = (a: string, b: string) => a.trim() !== "" && a.trim() === b.trim();

export default function PortalPeople({ kind, title, href }: { kind: "birthday" | "hire"; title: string; href: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [locs, setLocs] = useState<number[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [approved, setApproved] = useState<number[]>([]);
  const [mode, setMode] = useState<"all" | "approved">("all");
  const [days, setDays] = useState(7);
  const [hirePeriod, setHirePeriod] = useState<"days" | "month">("days");
  const [hireInsights, setHireInsights] = useState<{ counts: { threeMonths: number; month: number; missingDate: number; missingLocation: number }; incomplete: { id: number; name: string; missingDate: boolean; missingLocation: boolean }[] } | null>(null);
  const [hireInsightsError, setHireInsightsError] = useState(false);
  const [text, setText] = useState("");
  const [todayText, setTodayText] = useState("");
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [prev, setPrev] = useState(0);
  const [previewLocation, setPreviewLocation] = useState("");
  const [insights, setInsights] = useState<BirthdayInsightsData | null>(null);
  const [insightsError, setInsightsError] = useState(false);
  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [unitIdFilter, setUnitIdFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);
  const requestId = useRef(0);
  const [cards] = useCards();
  const homeCard = cards.find((c) => c.id === (kind === "birthday" ? "birthday" : "hire"));

  const load = useCallback(async (win?: number, period?: "days" | "month") => {
    const id = ++requestId.current;
    try {
      const r = await fetch(`/api/hr/portal-people?kind=${kind}${win ? `&days=${win}` : ""}${period ? `&period=${period}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 403 ? "دسترسی ندارید." : "خطا در دریافت اطلاعات");
      const j: Data = await r.json();
      if (id !== requestId.current) return;
      setD(j);
      if (win === undefined) { setLocs(j.cfg.locs); setHidden(j.cfg.hidden); setApproved(j.cfg.approved); setMode(j.cfg.mode); setDays(j.cfg.days); setHirePeriod(j.cfg.hirePeriod === "month" ? "month" : "days"); setText(j.cfg.text); setTodayText(j.cfg.todayText); setDirty(false); }
    } catch (e) { if (id === requestId.current) setMsg(e instanceof Error ? e.message : "خطا در دریافت اطلاعات"); }
  }, [kind]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (kind === "hire") { const params = new URLSearchParams(window.location.search); setLocationFilter(params.get("location") || ""); setUnitIdFilter(params.get("unit") || ""); } }, [kind]);
  useEffect(() => {
    if (kind !== "hire") return;
    const controller = new AbortController();
    fetch("/api/hr/hire-insights", { cache: "no-store", signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setHireInsights).catch(() => { if (!controller.signal.aborted) setHireInsightsError(true); });
    return () => controller.abort();
  }, [kind]);
  useEffect(() => {
    if (kind !== "birthday") return;
    const controller = new AbortController();
    fetch("/api/hr/birthday-insights", { cache: "no-store", signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setInsights).catch(() => { if (!controller.signal.aborted) setInsightsError(true); });
    return () => controller.abort();
  }, [kind]);

  // هشدار خروج با تغییر ذخیره‌نشده
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const ch = <T,>(f: (v: T) => void) => (v: T) => { f(v); setDirty(true); };
  const toggle = (arr: number[], id: number) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const locOk = (r: Row) => !locs.length || (r.locationId != null && locs.includes(r.locationId));
  const checked = (r: Row) => (mode === "approved" ? approved.includes(r.id) : !hidden.includes(r.id));
  const shown = (r: Row) => checked(r) && locOk(r);
  const note = (r: Row) => (kind === "birthday" && r.days === 0 && todayText ? todayText : text.replace("{date}", r.label));
  const flip = (r: Row) => { if (mode === "approved") setApproved(toggle(approved, r.id)); else setHidden(toggle(hidden, r.id)); setDirty(true); };
  const changeDays = (v: number) => { setDays(v); setHirePeriod("days"); setDirty(true); requestId.current++; if (v >= 1 && d) void load(Math.min(v, d.max), "days"); };
  const changeHirePeriod = (period: "days" | "month", value = days) => { setHirePeriod(period); if (period === "days") setDays(value); setDirty(true); setPrev(0); void load(value, period); };
  const clearFilters = () => { setLocs([]); setDirty(true); };
  const discard = () => { setPrev(0); load(); setMsg(""); };

  const save = async () => {
    if (!d || !Number.isInteger(days) || days < 1 || days > d.max) { setMsg(`بازه باید بین ۱ و ${d?.max || 60} روز باشد.`); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/hr/portal-people", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, locs, hidden, approved, mode, days, hirePeriod, text, todayText }) });
      if (!r.ok) throw new Error();
      setMsg("تنظیمات ذخیره شد."); setDirty(false); await load();
    } catch { setMsg("ذخیره تنظیمات ممکن نشد. اتصال و دسترسی را بررسی کنید."); }
    finally { setBusy(false); }
  };
  const savePhoto = async (id: number, photo: string | null) => {
    setPhotoBusy(id);
    try {
      const response = await fetch("/api/hr/portal-people/photo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, photo }) });
      if (!response.ok) throw new Error();
      setD((current) => current ? { ...current, rows: current.rows.map((row) => row.id === id ? { ...row, photo } : row) } : current);
      setMsg(photo ? "عکس کارت پرتال ذخیره شد." : "عکس کارت پرتال حذف شد.");
    } catch { setMsg("ذخیره عکس ممکن نشد. اتصال و دسترسی را بررسی کنید."); }
    finally { setPhotoBusy(null); }
  };
  const choosePhoto = async (id: number, file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setMsg("عکس باید JPG، PNG یا WebP و حداکثر ۱۰ مگابایت باشد."); return; }
    setPhotoBusy(id);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error("ابعاد عکس پشتیبانی نمی‌شود.");
      const scale = Math.min(1, 600 / image.naturalWidth, 600 / image.naturalHeight);
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("پردازش تصویر در مرورگر ممکن نیست.");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let blob: Blob | null = null;
      for (const quality of [0.82, 0.7, 0.58, 0.45]) { blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality)); if (blob?.type === "image/webp" && blob.size <= 150 * 1024) break; }
      if (!blob || blob.type !== "image/webp" || blob.size > 150 * 1024) throw new Error("بهینه‌سازی عکس ممکن نشد؛ عکس دیگری انتخاب کنید.");
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("خواندن عکس ممکن نشد.")); reader.readAsDataURL(blob!); });
      await savePhoto(id, data);
    } catch (e) { setMsg(e instanceof Error ? e.message : "پردازش عکس ممکن نشد."); }
    finally { URL.revokeObjectURL(url); setPhotoBusy(null); }
  };

  const list = d ? d.rows.filter(r => shown(r) && r.locationId != null && (!previewLocation || String(r.locationId) === previewLocation)) : [];
  const filtered = d ? d.rows.filter((r) => (!query.trim() || `${r.name} ${r.unit} ${r.location}`.toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa"))) && (!unitFilter || r.unit === unitFilter) && (!unitIdFilter || String(r.unitId ?? "missing") === unitIdFilter) && (!locationFilter || String(r.locationId ?? "missing") === locationFilter) && (visibilityFilter === "all" || (visibilityFilter === "shown" ? shown(r) && r.locationId != null : visibilityFilter === "hidden" ? !checked(r) : visibilityFilter === "missing" ? checked(r) && locOk(r) && r.locationId == null : checked(r) && !locOk(r)))) : [];
  const setFiltered = (on: boolean) => { const ids = filtered.map((r) => r.id); if (!ids.length) return; if (mode === "approved") setApproved((v) => on ? [...new Set([...v, ...ids])] : v.filter((id) => !ids.includes(id))); else setHidden((v) => on ? v.filter((id) => !ids.includes(id)) : [...new Set([...v, ...ids])]); setDirty(true); };
  const card = list[prev % Math.max(list.length, 1)];
  const counts = d ? { shown: d.rows.filter(r => shown(r) && r.locationId != null).length, hidden: d.rows.filter((r) => !checked(r)).length, out: d.rows.filter((r) => checked(r) && !locOk(r)).length } : null;
  const previewRow = (r: Row) => { if (r.locationId == null || !shown(r)) { setMsg("این فرد با تنظیمات فعلی یا به دلیل نداشتن محل خدمت قابل نمایش نیست."); return; } setPreviewLocation(String(r.locationId)); const next = d!.rows.filter(x => shown(x) && x.locationId === r.locationId); setPrev(Math.max(0, next.findIndex(x => x.id === r.id))); };
  // گروه‌بندی تولد: امروز / این هفته / بعدتر
  const groupOf = (r: Row) => (kind !== "birthday" ? "" : r.days === 0 ? "امروز" : r.days <= 7 ? "این هفته" : "بعدتر");
  const cardSub = (r: Row) => [r.unit, r.title].filter(Boolean).filter((v, i, a) => !(i === 1 && sameText(v, a[0]))).join(" · ");

  const chip = (on: boolean, label: string, fn: () => void, k?: string | number) => (
    <button key={k} type="button" aria-pressed={on} className={`pp-chip${on ? " on" : ""}`} onClick={fn}>{label}</button>
  );
  const fa = (n: number) => n.toLocaleString("fa-IR");

  return (
    <PageFrame id="hr" title={title} activeHref={href}>
      {msg && <div role="status"><Note>{msg}</Note></div>}
      {!d && !msg && <Note>در حال دریافت اطلاعات…</Note>}
      {d && (
        <div className={`pp-page${kind === "hire" ? " pp-hire-page" : ""}`}>
          <header className="pp-hero"><div><span>مدیریت محتوای پرتال</span><h1>مدیریت {title}</h1><p>فهرست و تنظیمات در سطح سازمان است؛ هر همکار در پرتال فقط افراد محل خدمت خود را می‌بیند.</p></div><span className="pp-hero-icon" aria-hidden="true">{kind === "birthday" ? "🎁" : "✦"}</span></header>
          <fieldset className="pp-editor" disabled={busy}>
          <div className="pp-stats">
            {kind === "hire" && hireInsights && <><div className="pp-stat"><small>ماه جاری شمسی · کل سازمان</small><b>{fa(hireInsights.counts.month)}</b></div><div className="pp-stat"><small>سه ماه اخیر (۹۰ روز) · کل سازمان</small><b>{fa(hireInsights.counts.threeMonths)}</b></div><div className="pp-stat"><small>تاریخ استخدام ناقص · کارکنان فعال</small><b>{fa(hireInsights.counts.missingDate)}</b></div><div className="pp-stat"><small>بدون محل خدمت · کارکنان فعال</small><b>{fa(hireInsights.counts.missingLocation)}</b></div></>}
            {kind === "birthday" && insights && <><div className="pp-stat"><small>تولد امروز · کل سازمان</small><b>{fa(insights.counts.today)}</b></div><div className="pp-stat"><small>۷ روز آینده · بدون امروز</small><b>{fa(insights.counts.week)}</b></div><div className="pp-stat"><small>بدون محل خدمت · کارکنان فعال</small><b>{fa(insights.counts.missingLocation)}</b></div><div className="pp-stat"><small>تاریخ تولد ناقص · کارکنان فعال</small><b>{fa(insights.counts.missingBirthDate)}</b></div></>}
            <div className="pp-stat"><small>مجاز طبق تنظیمات</small><b>{fa(counts!.shown)}</b></div>
            <div className="pp-stat"><small>مخفی‌شده</small><b>{fa(counts!.hidden)}</b></div>
            <div className="pp-stat"><small>خارج از فیلتر محل</small><b>{fa(counts!.out)}</b></div>
            <div className="pp-stat"><small>کل در بازه</small><b>{fa(d.rows.length)}</b></div>
          </div>

          <div className="pp-cols">
            <div className="pp-main">
              <Card title="فهرست افراد">
                <p className="pp-photo-help">عکس‌ها پس از انتخاب بهینه و همان لحظه ذخیره می‌شوند؛ لغو تنظیمات، عکس را برنمی‌گرداند. فرمت JPG، PNG یا WebP، حداکثر ۱۰ مگابایت. افراد بدون محل خدمت در کارت کاربران نمایش داده نمی‌شوند.</p>
                <p className="pp-filter-note">{kind === "birthday" ? "فیلترهای زیر فقط برای بررسی فهرست و تقویم هستند و تنظیم نمایش پرتال را تغییر نمی‌دهند." : "فیلترهای زیر فقط فهرست را تغییر می‌دهند و تنظیمات نمایش پرتال را تغییر نمی‌دهند."}</p>
                <div className="pp-filters"><label>جست‌وجو<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="نام، واحد یا محل خدمت" /></label><label>واحد<select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}><option value="">همه واحدها</option>{[...new Set([...(insights?.birthdays || []), ...d.rows].map((r) => r.unit).filter(Boolean))].sort().map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label><label>فیلتر محل خدمت فهرست<select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}><option value="">همه محل‌ها</option>{d.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}<option value="missing">ثبت نشده</option></select></label><label>وضعیت<select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)}><option value="all">همه وضعیت‌ها</option><option value="shown">مجاز برای نمایش</option><option value="missing">محل خدمت ثبت نشده</option><option value="hidden">مخفی یا تأییدنشده</option><option value="out">خارج از فیلتر محل</option></select></label></div>
                {unitIdFilter && <p className="pp-filter-note">فیلتر واحد از داشبورد اعمال شده است. <button type="button" className="emp-link" onClick={() => setUnitIdFilter("")}>حذف فیلتر واحد</button></p>}
                <div className="pp-bulk"><span>{fa(filtered.length)} نفر در فهرست فیلترشده</span>{(query || unitFilter || unitIdFilter || locationFilter || visibilityFilter !== "all") && <button type="button" onClick={() => { setQuery(""); setUnitFilter(""); setUnitIdFilter(""); setLocationFilter(""); setVisibilityFilter("all"); }}>پاک کردن فیلترهای فهرست</button>}<button type="button" onClick={() => setFiltered(true)} disabled={!filtered.length}>انتخاب همه فهرست</button><button type="button" onClick={() => setFiltered(false)} disabled={!filtered.length}>لغو انتخاب فهرست</button></div>
                <div className="emp-scroll">
                  <table className="emp-table" style={{ width: "100%" }}>
                    <colgroup><col style={{ width: "10%" }} /><col style={{ width: "26%" }} /><col style={{ width: "16%" }} /><col style={{ width: "18%" }} /><col style={{ width: "15%" }} /><col style={{ width: "15%" }} /></colgroup>
                    <thead><tr><th>{mode === "approved" ? "تأیید" : "نمایش"}</th><th>نام</th><th>واحد</th><th>محل خدمت</th><th>{kind === "birthday" ? "تولد" : "استخدام"}</th><th>زمان</th></tr></thead>
                    <tbody>
                      {filtered.map((r, i) => {
                        const g = groupOf(r);
                        const newGroup = g && (i === 0 || groupOf(filtered[i - 1]) !== g);
                        const status = !checked(r) ? (mode === "approved" ? "تأیید نشده" : "مخفی") : !locOk(r) ? "خارج از محل مجاز" : r.locationId == null ? "بدون محل" : "مجاز";
                        return (
                          <Fragment key={r.id}>
                            {newGroup && <tr className="pp-group"><td colSpan={6}>{g}</td></tr>}
                            <tr className="pp-row" style={{ opacity: shown(r) ? 1 : 0.55, cursor: "default" }}>
                              <td><input type="checkbox" checked={checked(r)} onChange={() => flip(r)} aria-label={`انتخاب ${r.name} برای نمایش`} /></td>
                              <td><div className="pp-person-cell">{r.photo ? <img className="pp-row-photo" src={r.photo} alt="" /> : <span className="pp-av">{r.name.trim().charAt(0)}</span>}<div><a href={`/hr/employees?open=${r.id}`} className="pp-person-name">{r.name}</a><div className="pp-row-tools"><Badge tone={shown(r) && r.locationId != null ? "ok" : "warn"}>{status}</Badge><button type="button" onClick={() => previewRow(r)} title="نمایش در پیش‌نمایش کارت" aria-label={`پیش‌نمایش ${r.name}`}>◉</button><label className="pp-photo-pick" title={photoBusy === r.id ? "در حال ذخیره" : r.photo ? "تغییر عکس" : "افزودن عکس"}>▣<input disabled={photoBusy !== null} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`انتخاب عکس ${r.name}`} onChange={(e) => { void choosePhoto(r.id, e.target.files?.[0]); e.target.value = ""; }} /></label>{r.photo && <button type="button" disabled={photoBusy !== null} title="حذف عکس" aria-label={`حذف عکس ${r.name}`} onClick={() => { if (confirm(`عکس ${r.name} از کارت پرتال حذف شود؟`)) void savePhoto(r.id, null); }}>×</button>}</div></div></div></td>
                              <td className="pp-dim">{r.unit || "—"}</td>
                              <td className="pp-dim">{r.location || "—"}</td>
                              <td>{r.label}</td>
                              <td>{relTxt(kind, r.days)}</td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length === 0 && <div className="emp-empty pp-empty"><span aria-hidden="true">{kind === "birthday" ? "🎁" : "♙"}</span><b>{d.rows.length ? "با این فیلترها موردی پیدا نشد." : "در این بازه موردی وجود ندارد."}</b><small>{d.rows.length ? "جست‌وجو یا فیلترها را تغییر دهید." : "بازه را بررسی کنید؛ اطلاعات تاریخ باید در پرونده همکاران ثبت شده باشد."}</small></div>}
                </div>
              </Card>
            </div>

            <div className="pp-side">
              <Card title="پیش‌نمایش کارت صفحه‌ی اصلی">
                <label className="pp-preview-select">مشاهده از محل خدمت<select value={previewLocation} onChange={e => { setPreviewLocation(e.target.value); setPrev(0); }}><option value="">نمای مدیریتی · همه محل‌ها</option>{d.locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                <div className={`hp-card hp-person ${kind === "birthday" ? "hp-birthday" : "hp-hire"}`} style={homeCard?.image ? { backgroundImage: `url(${JSON.stringify(homeCard.image)})` } : undefined}>
                  {card?.photo ? <img src={card.photo} alt="" /> : <img src="/assets/sample/avatar-sample.svg" alt="" />}
                  <div>
                    <span style={{ color: homeCard?.titleColor }}>• {homeCard?.title || title}{list.length > 1 ? ` (${fa((prev % list.length) + 1)}/${fa(list.length)})` : ""}</span>
                    {homeCard?.text && <p className="hp-cfg-text">{homeCard.text}</p>}
                    {card ? <>{kind === "hire" ? <><b>{card.name}</b>{cardSub(card) && <small className="pp-preview-sub">{cardSub(card)}</small>}</> : <b>{card.name}{cardSub(card) ? ` · ${cardSub(card)}` : ""}</b>}<small>{note(card)}</small></> : <small>موردی برای نمایش وجود ندارد.</small>}
                  </div>
                </div>
                <p className="pp-preview-note">{previewLocation ? "این پیش‌نمایش افراد مجاز در محل انتخابی را با تنظیمات فعلی نشان می‌دهد." : "نمای مدیریتی همه محل‌هاست؛ برای دیدن نمای واقعی یک کاربر، محل خدمت را انتخاب کنید."}</p>{list.length > 1 && <div className="pp-preview-nav"><Button size="sm" onClick={() => setPrev((prev - 1 + list.length) % list.length)}>قبلی</Button><Button size="sm" onClick={() => setPrev((prev + 1) % list.length)}>بعدی</Button></div>}
              </Card>

              <Card title="تنظیمات نمایش">
                {kind === "hire" && <><div className="ui-label">بازه نمایش استخدام‌ها</div><div className="pp-chips">{chip(hirePeriod === "month", "ماه جاری شمسی", () => changeHirePeriod("month"))}{[30, 90, 180, 365].map(n => chip(hirePeriod === "days" && days === n, `${fa(n)} روز اخیر`, () => changeHirePeriod("days", n), n))}</div><p className="pp-hint">ماه جاری از روز اول ماه شمسی تا امروز است؛ این بازه پس از ذخیره بر کارت صفحه اصلی اثر می‌گذارد.</p></>}
                {(kind === "birthday" || hirePeriod === "days") && <Input label={`بازه دلخواه (روز، حداکثر ${fa(d.max)}) — ${kind === "birthday" ? "روز آینده" : "روز اخیر"}`} type="number" min={1} max={d.max} value={days} onChange={(e) => changeDays(Number(e.target.value))} />}
                <div className="ui-label">روش نمایش</div>
                <div className="pp-chips">
                  {chip(mode === "all", "همه، به‌جز مخفی‌شده‌ها", () => ch(setMode)("all"))}
                  {chip(mode === "approved", "فقط تأییدشده‌ها", () => ch(setMode)("approved"))}
                </div>
                <p className="pp-hint">در حالت اول همه افراد به‌جز موارد مخفی مجازند؛ در حالت دوم فقط افراد انتخاب‌شده مجازند. محل خدمت هر بیننده نیز جداگانه اعمال می‌شود.</p>
                <div className="ui-label">محل‌های مجاز برای نمایش در پرتال</div>
                <p className="pp-hint">این تنظیم پس از ذخیره روی نمایش کارت کاربران اثر می‌گذارد و از فیلتر فهرست مستقل است.</p>
                <div className="pp-chips">
                  {[{ id: 0, name: "همه" }, ...d.locations].map((l) => chip(l.id === 0 ? !locs.length : locs.includes(l.id), l.name, () => (l.id === 0 ? clearFilters() : ch(setLocs)(toggle(locs, l.id))), l.id))}
                </div>
                <Input label={`متن کارت${kind === "birthday" ? " ({date} = تاریخ تولد)" : ""}`} value={text} onChange={(e) => ch(setText)(e.target.value)} />
                {kind === "birthday" && <Input label="متن روز تولد" value={todayText} onChange={(e) => ch(setTodayText)(e.target.value)} />}
                <div style={{ marginTop: 10 }}><button type="button" className="emp-link" onClick={() => { setText(d.defaults.text); setTodayText(d.defaults.todayText); setDirty(true); }}>بازگشت به متن پیش‌فرض</button></div>
              </Card>
            </div>
          </div>

          {kind === "hire" && (hireInsights ? <div className="pp-insights"><Card title="اطلاعات نیازمند تکمیل · کل سازمان"><p className="pp-hint">کارکنان فعال با تاریخ استخدام نامعتبر یا بدون محل خدمت؛ افراد بدون تاریخ معتبر در فهرست استخدام‌ها قرار نمی‌گیرند.</p><div className="pp-incomplete">{hireInsights.incomplete.length ? hireInsights.incomplete.map(r => <a href={`/hr/employees?open=${r.id}`} key={r.id}><b>{r.name}</b><span>{[r.missingDate && "تاریخ استخدام ناقص", r.missingLocation && "بدون محل خدمت"].filter(Boolean).join(" · ")}</span></a>) : <p>موردی نیازمند تکمیل نیست.</p>}</div></Card></div> : hireInsightsError ? <Note>دریافت گزارش اطلاعات ناقص ممکن نشد.</Note> : <Note>در حال دریافت گزارش اطلاعات ناقص…</Note>)}
          {kind === "birthday" && (insights ? <BirthdayInsights data={insights} query={query} unit={unitFilter} location={locationFilter} /> : insightsError ? <Note>دریافت تقویم و گزارش اطلاعات ناقص ممکن نشد.</Note> : <Note>در حال دریافت تقویم و گزارش اطلاعات ناقص…</Note>)}

          </fieldset>
          <div className={`pp-save${dirty ? " is-dirty" : ""}`}>
            {dirty && <span>تغییرات ذخیره‌نشده</span>}
            {dirty && <Button size="sm" onClick={discard} disabled={busy}>لغو تغییرات</Button>}
            <Button variant="primary" onClick={save} disabled={!dirty || busy}>{busy ? "در حال ذخیره…" : "ذخیره تنظیمات"}</Button>
          </div>
        </div>
      )}
    </PageFrame>
  );
}
