"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Note } from "@/components/ui";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { SharedContentStatus } from "@/components/SharedContentStatus";
import { useAnnouncements, type Announcement, SUMMARY_MAX } from "@/services/lobbyNews";
import { optimizeSlide } from "@/lib/optimizeSlide";

const empty = { title: "", summary: "", body: "", poster: "", portal: true, lobby: true, from: "", to: "", pinned: false, locationIds: [] as number[] };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());

export default function ManageAnnouncements() {
  const store = useAnnouncements();
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [locations, setLocations] = useState<{id:number;name:string}[]>([]);
  const [locationError, setLocationError] = useState(false);
  const [locationsReady, setLocationsReady] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [destination, setDestination] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savePending, setSavePending] = useState(false);
  useEffect(() => { fetch("/api/lobby/locations", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setLocations).catch(() => setLocationError(true)).finally(() => setLocationsReady(true)); }, []);
  const hasDraft = !!(editId || form.title || form.summary || form.body || form.poster || form.from || form.to || form.pinned || !form.portal || !form.lobby || form.locationIds.length);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (hasDraft || store.dirty) { event.preventDefault(); event.returnValue = ""; } };
    const warnNavigation = (event: MouseEvent) => {
      if ((!hasDraft && !store.dirty) || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.origin !== window.location.origin || anchor.pathname === window.location.pathname) return;
      if (!window.confirm("تغییرات ذخیره‌نشده دارید. از صفحه خارج می‌شوید؟")) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn); document.addEventListener("click", warnNavigation, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", warnNavigation, true); };
  }, [hasDraft, store.dirty]);
  const reset = () => { setForm(empty); setEditId(null); setMessage(""); };
  useEffect(() => { if (!savePending) return; if (store.status === "ready" && !store.dirty) { setMessage("تغییرات با موفقیت ذخیره شد."); setSavePending(false); } else if (store.status === "error" || store.status === "conflict") { setMessage("ذخیره انجام نشد؛ وضعیت و گزینه‌های بازیابی را بررسی کنید."); setSavePending(false); } }, [savePending, store.status, store.dirty]);
  const edit = (item: Announcement) => { setEditId(item.id); setForm({ title:item.title, summary:item.summary, body:item.body || "", poster:item.poster || "", portal:item.portal, lobby:item.lobby, from:item.from || "", to:item.to || "", pinned:!!item.pinned, locationIds:item.locationIds || [] }); document.getElementById("announcement-editor")?.scrollIntoView({ behavior:"smooth" }); };
  const submit = () => {
    if (!form.title.trim() || !form.summary.trim()) return setMessage("عنوان و خلاصه الزامی هستند.");
    if (!form.portal && !form.lobby) return setMessage("حداقل یک محل نمایش را انتخاب کنید.");
    if (form.from && form.to && form.from > form.to) return setMessage("تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد.");
    const original = store.items.find(item => item.id === editId);
    const now = new Date();
    const item: Announcement = { ...original, ...form, title:form.title.trim(), summary:form.summary.trim(), id:original?.id || crypto.randomUUID(), date:original?.date || today(), createdAt:original ? original.createdAt : now.toISOString(), body:form.body.trim() || undefined, poster:form.poster || undefined, from:form.from || undefined, to:form.to || undefined };
    store.save(original ? store.items.map(current => current.id === original.id ? item : current) : [item, ...store.items]);
    reset();
    setMessage("در حال ذخیره اطلاعیه..."); setSavePending(true); setPreviewOpen(false);
  };
  const statusOf = (item: Announcement) => item.disabled || !item.portal && !item.lobby ? "off" : item.from && item.from > today() ? "scheduled" : item.to && item.to < today() ? "expired" : "active";
  const statusLabel: Record<string,string> = { active:"در حال نمایش", scheduled:"زمان‌بندی‌شده", expired:"پایان‌یافته", off:"غیرفعال" };
  const visible = store.items.filter(item => `${item.title} ${item.summary}`.toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa")) && (filter === "all" || statusOf(item) === filter) && (destination === "all" || (destination === "portal" ? item.portal : item.lobby)) && (locationFilter === "all" || (locationFilter === "global" ? !item.locationIds?.length : !item.locationIds?.length || item.locationIds.includes(Number(locationFilter)))));
  return <AppShell title="مدیریت اطلاعیه‌ها" activeHref="/announcements/manage"><div className="lobby-admin announcement-page"><div className="announcement-top"><div><h1>مدیریت اطلاعیه‌ها</h1><p>ثبت و مدیریت پیام‌های روابط عمومی برای پرتال و تلویزیون لابی</p></div><Link href="/announcements">مشاهده صفحه اطلاعیه‌ها ←</Link></div>
    <div className="lobby-admin-section"><Card title="ثبت و ویرایش اطلاعیه"><SharedContentStatus label="اطلاعیه‌ها" legacyKey="lobby.news.v1" {...store} /><fieldset disabled={store.status !== "ready" && store.status !== "saving"}><div className="lobby-form-panel" id="announcement-editor"><b>{editId ? "ویرایش اطلاعیه" : "اطلاعیه جدید"}</b><div className="announcement-form-section"><h4>محتوا</h4>
      <label>عنوان<input value={form.title} maxLength={120} onChange={e => setForm({...form,title:e.target.value})} /></label>
      <label>خلاصه<textarea rows={2} maxLength={SUMMARY_MAX} value={form.summary} onChange={e => setForm({...form,summary:e.target.value})} /></label><small>{form.summary.length.toLocaleString("fa-IR")} / {SUMMARY_MAX.toLocaleString("fa-IR")}</small>
      <label>متن کامل (اختیاری)<textarea rows={5} value={form.body} onChange={e => setForm({...form,body:e.target.value})} /></label>
      <span>تصویر اختیاری؛ JPG، PNG یا WebP تا ۱۰ مگابایت</span><label className="lobby-header-upload">انتخاب تصویر<input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={async e => { const file=e.target.files?.[0]; e.target.value=""; if (!file) return; setImageBusy(true); setMessage("در حال آماده‌سازی تصویر..."); try { const result=await optimizeSlide(file); setForm(current=>({...current,poster:result.image})); setMessage("تصویر آماده است."); } catch(error) { setMessage(error instanceof Error ? error.message : "پردازش تصویر ممکن نشد."); } finally { setImageBusy(false); } }} /></label>
      {form.poster && <div><img src={form.poster} alt="پیش‌نمایش تصویر اطلاعیه" className="announcement-preview" /><Button size="sm" onClick={()=>setForm({...form,poster:""})}>حذف تصویر</Button></div>}</div><div className="announcement-form-section"><h4>زمان‌بندی</h4>
      <div className="announcement-dates"><div><span>نمایش از تاریخ</span><JalaliDateInput label="شروع نمایش" value={form.from || undefined} onChange={v=>setForm({...form,from:v || ""})} /></div><div><span>تا تاریخ</span><JalaliDateInput label="پایان نمایش" value={form.to || undefined} onChange={v=>setForm({...form,to:v || ""})} /></div></div><small>خالی بودن تاریخ یعنی بدون محدودیت.</small>
      </div><div className="announcement-form-section"><h4>مخاطبان و محل نمایش</h4><b>محل نمایش</b><div className="lobby-option-row"><label><input type="checkbox" checked={form.portal} onChange={e=>setForm({...form,portal:e.target.checked})} /> پرتال</label><label><input type="checkbox" checked={form.lobby} onChange={e=>setForm({...form,lobby:e.target.checked})} /> تلویزیون لابی</label><label><input type="checkbox" checked={form.pinned} onChange={e=>setForm({...form,pinned:e.target.checked})} /> سنجاق در ابتدای فهرست</label></div>
      <b>مخاطبان بر اساس محل خدمت</b><small>بدون انتخاب محل، اطلاعیه برای همه محل‌ها نمایش داده می‌شود.</small>{locationError ? <p role="alert">دریافت محل‌های خدمت ممکن نشد؛ صفحه را دوباره بارگذاری کنید.</p> : <div className="lobby-option-row">{locations.map(location=><label key={location.id}><input type="checkbox" checked={form.locationIds.includes(location.id)} onChange={e=>setForm({...form,locationIds:e.target.checked ? [...form.locationIds,location.id] : form.locationIds.filter(id=>id!==location.id)})} /> {location.name}</label>)}</div>}
      </div>{previewOpen && <section className="announcement-live-preview" aria-label="پیش‌نمایش اطلاعیه"><h4>پیش‌نمایش اطلاعیه</h4>{form.poster && <img src={form.poster} alt="" />}<strong>{form.title || "عنوان اطلاعیه"}</strong><p>{form.summary || "خلاصه اطلاعیه"}</p>{form.body && <p className="announcement-preview-body">{form.body}</p>}<small>{form.pinned ? "مهم · " : ""}{[form.portal && "پرتال",form.lobby && "لابی"].filter(Boolean).join(" و ") || "مقصدی انتخاب نشده است"}</small></section>}
      {message && <p role="status" className="announcement-feedback">{message}</p>}<div className="announcement-actions"><Button variant="primary" disabled={locationError || !locationsReady || imageBusy} onClick={submit}>{editId ? "ذخیره تغییرات" : "ثبت اطلاعیه"}</Button><Button onClick={()=>setPreviewOpen(!previewOpen)}>{previewOpen ? "بستن پیش‌نمایش" : "پیش‌نمایش"}</Button>{editId && <Button onClick={reset}>انصراف</Button>}</div>
    </div></fieldset></Card>
    <Card title="اطلاعیه‌های ثبت‌شده"><div className="lobby-news-filters"><label>جست‌وجو<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="عنوان یا خلاصه" /></label><label>وضعیت<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">همه وضعیت‌ها</option>{Object.entries(statusLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>مقصد نمایش<select value={destination} onChange={e=>setDestination(e.target.value)}><option value="all">همه مقصدها</option><option value="portal">پرتال</option><option value="lobby">لابی</option></select></label><label>محل خدمت<select value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}><option value="all">همه محل‌ها</option><option value="global">اطلاعیه‌های همه محل‌ها</option>{locations.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></label></div><div className="announcement-filter-actions"><p>{visible.length.toLocaleString("fa-IR")} اطلاعیه</p><Button size="sm" onClick={()=>{setQuery("");setFilter("all");setDestination("all");setLocationFilter("all");}}>پاک‌کردن فیلترها</Button></div>{message && <p role="status" className="announcement-feedback">{message}</p>}<div className="announcement-list">{visible.map(item=><article key={item.id}><div><strong>{item.title}</strong><p>{item.summary}</p><div className="announcement-badges"><span>{statusLabel[statusOf(item)]}</span>{item.portal && <span>پرتال</span>}{item.lobby && <span>لابی</span>}<span>{item.locationIds?.length ? item.locationIds.map(id=>locations.find(location=>location.id===id)?.name || `محل ${id}`).join("، ") : "همه محل‌ها"}</span>{item.pinned && <span>مهم</span>}</div></div><div className="announcement-actions"><Button size="sm" onClick={()=>edit(item)}>ویرایش</Button><Button size="sm" disabled={store.status !== "ready"} onClick={()=>{store.save(store.items.map(current=>current.id===item.id ? {...current,disabled:!item.disabled} : current));setMessage("در حال ذخیره وضعیت...");setSavePending(true);}}>{item.disabled ? "فعال‌کردن" : "غیرفعال‌کردن"}</Button>{item.disabled && <Button size="sm" disabled={store.status !== "ready"} onClick={()=>{if(confirm(`اطلاعیه غیرفعال «${item.title}» برای همیشه حذف شود؟`)){store.save(store.items.filter(current=>current.id!==item.id));if(editId===item.id)reset();setMessage("در حال حذف اطلاعیه...");setSavePending(true);}}}>حذف نهایی</Button>}</div></article>)}</div>{!visible.length && <Note>اطلاعیه‌ای با این شرایط یافت نشد.</Note>}</Card></div></div></AppShell>;
}
