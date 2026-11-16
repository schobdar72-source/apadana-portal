"use client";

import { useCallback, useEffect, useState } from "react";

type Notice = { id: string; title: string; body: string; active: boolean; createdAt: string; locationIds?: number[]; demoBatch?: string };
type Contact = { phone: string; extension: string; email: string; details: string };
const blank: Contact = { phone: "", extension: "", email: "", details: "" };

export function HrContent({ manager }: { manager: boolean }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [visibleNoticeIds, setVisibleNoticeIds] = useState<string[]>([]);
  const [contact, setContact] = useState<Contact>(blank);
  const [contactForm, setContactForm] = useState<Contact>(blank);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [noticeLocations, setNoticeLocations] = useState<number[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/hr/content", { cache: "no-store" });
    if (!response.ok) throw new Error("load");
    const result = await response.json();
    setNotices(result.notices);
    setVisibleNoticeIds(result.visibleNoticeIds || []);
    setContact(result.contact);
    setContactForm(result.contact);
    setLocations(result.locations || []);
    setLoadError(false);
  }, []);

  useEffect(() => { let live = true; load().catch(() => { if (live) { setLoadError(true); setError("دریافت اطلاعات منابع انسانی ممکن نشد."); } }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [load]);

  async function save(payload: Record<string, unknown>, success: string) {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/hr/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ذخیره انجام نشد.");
      await load(); setMessage(success); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "ارتباط با سرور برقرار نشد."); return false; }
    finally { setBusy(false); }
  }
  function resetNotice() { setEditId(null); setTitle(""); setBody(""); setActive(true); setNoticeLocations([]); }
  const visible = notices.filter((n) => visibleNoticeIds.includes(n.id));

  return <>
    <section className="hrd-card hrd-announcements" aria-labelledby="hr-notice-heading">
      <div className="hrd-card-title"><span className="hrd-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14l-2-2V10a5 5 0 0 0-10 0v5zM10 20h4"/></svg></span><div><h3 id="hr-notice-heading">اطلاعیه‌های منابع انسانی</h3><p>خبرهای ویژه همکاران</p></div></div>
      {loading ? <p className="hrd-muted">در حال دریافت اطلاعیه‌ها…</p> : loadError ? <p className="hrd-muted">دریافت اطلاعیه‌ها ممکن نشد.</p> : visible.length ? <div className="hrd-notice-list">{visible.map((notice) => <article className="hrd-notice" key={notice.id}><h4>{notice.title}</h4><p>{notice.body}</p><time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleDateString("fa-IR")}</time></article>)}</div> : <div className="hrd-empty"><p>در حال حاضر اطلاعیه فعالی وجود ندارد.</p></div>}
    </section>
    <section className="hrd-contact"><span className="hrd-icon" aria-hidden="true">☎</span><div><h2>ارتباط با منابع انسانی</h2><p>{contact.details || "برای اصلاح اطلاعات پرسنلی یا دریافت راهنمایی با واحد منابع انسانی تماس بگیرید."}</p>{loading ? <small>در حال دریافت اطلاعات تماس…</small> : loadError ? <small>دریافت اطلاعات تماس ممکن نشد.</small> : contact.phone || contact.extension || contact.email ? <div className="hrd-contact-items">{contact.phone && <span>تلفن: <b dir="ltr">{contact.phone}</b></span>}{contact.extension && <span>داخلی: <b dir="ltr">{contact.extension}</b></span>}{contact.email && <span>ایمیل: <b dir="ltr">{contact.email}</b></span>}</div> : <small>اطلاعات تماس این واحد هنوز ثبت نشده است.</small>}</div></section>
    {manager && <details className="hrd-card hrd-content-admin"><summary>مدیریت اطلاعیه‌ها و اطلاعات تماس</summary><p className="hrd-muted">اطلاعات ذخیره‌شده برای همکاران در همین صفحه نمایش داده می‌شود.</p>
      <div className="hrd-admin-edit-grid"><section><h3>اطلاعات تماس</h3><form onSubmit={(e) => { e.preventDefault(); void save({ action: "contact", ...contactForm }, "اطلاعات تماس ذخیره شد."); }} className="hrd-editor">
        <label>شماره تماس<input maxLength={60} value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}/></label>
        <label>شماره داخلی<input maxLength={30} value={contactForm.extension} onChange={(e) => setContactForm({ ...contactForm, extension: e.target.value })}/></label>
        <label>ایمیل<input type="email" maxLength={254} value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}/></label>
        <label>توضیحات تماس<textarea maxLength={500} rows={3} value={contactForm.details} onChange={(e) => setContactForm({ ...contactForm, details: e.target.value })}/></label>
        <button className="hrd-button" disabled={busy || loading} type="submit">ذخیره اطلاعات تماس</button>
      </form></section><section><h3>{editId ? "ویرایش اطلاعیه" : "ثبت اطلاعیه جدید"}</h3><form onSubmit={async (e) => { e.preventDefault(); if (await save({ action: "saveNotice", ...(editId ? { id: editId } : {}), title, body, active, locationIds: noticeLocations }, "اطلاعیه ذخیره شد.")) resetNotice(); }} className="hrd-editor">
        <label>عنوان اطلاعیه<input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}/></label>
        <label>متن اطلاعیه<textarea required maxLength={2000} rows={5} value={body} onChange={(e) => setBody(e.target.value)}/></label>
        <fieldset className="hrd-notice-locations"><legend>مخاطبان بر اساس محل خدمت</legend><small>اگر محلی انتخاب نشود، برای همه همکاران نمایش داده می‌شود.</small>{locations.map(l => <label className="hrd-check" key={l.id}><input type="checkbox" checked={noticeLocations.includes(l.id)} onChange={() => setNoticeLocations(ids => ids.includes(l.id) ? ids.filter(id => id !== l.id) : [...ids, l.id])}/>{l.name}</label>)}</fieldset>
        <label className="hrd-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> نمایش برای همکاران</label>
        <div className="hrd-editor-actions"><button className="hrd-button" disabled={busy || loading} type="submit">{editId ? "ذخیره تغییرات" : "ثبت اطلاعیه"}</button>{editId && <button type="button" className="hrd-secondary" onClick={resetNotice}>انصراف</button>}</div>
      </form></section></div>
      {(message || error) && <p className={error ? "hrd-form-error" : "hrd-form-success"} role="status">{error || message}</p>}
      <h3>اطلاعیه‌های ثبت‌شده</h3>{loading ? <p className="hrd-muted">در حال دریافت…</p> : notices.length ? <div className="hrd-admin-notices">{notices.map((notice) => <div key={notice.id}><span><b>{notice.title}</b><small>{notice.active ? "در حال نمایش" : "غیرفعال"} · {notice.locationIds?.length ? notice.locationIds.map(id => locations.find(l => l.id === id)?.name || "محل نامشخص").join("، ") : "همه محل‌ها"}{notice.demoBatch ? " · نمونه" : ""}</small></span><div className="hrd-editor-actions"><button className="hrd-secondary" type="button" disabled={busy} onClick={() => { setEditId(notice.id); setTitle(notice.title); setBody(notice.body); setActive(notice.active); setNoticeLocations(notice.locationIds || []); }}>ویرایش</button><button className="hrd-secondary hrd-delete" type="button" disabled={busy} onClick={() => { if (window.confirm(`اطلاعیه «${notice.title}» حذف شود؟`)) void save({ action: "deleteNotice", id: notice.id }, "اطلاعیه حذف شد.").then((ok) => { if (ok && editId === notice.id) resetNotice(); }); }}>حذف</button></div></div>)}</div> : <p className="hrd-muted">هنوز اطلاعیه‌ای ثبت نشده است.</p>}
    </details>}
  </>;
}
