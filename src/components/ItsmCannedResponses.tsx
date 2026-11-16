"use client";

import { useEffect, useState } from "react";
import { itsmNotify, useItsmDialogs } from "@/components/ItsmFeedback";

type Group = { id: number; name: string };
type ResponseItem = { id: string; title: string; body: string };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", headers: { "Content-Type": "application/json" } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "عملیات انجام نشد.");
  return data as T;
}

export function ItsmCannedResponses({ groups }: { groups: Group[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? 0);
  const [items, setItems] = useState<ResponseItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const { ask, dialogs } = useItsmDialogs();
  async function load(id: number) { setLoading(true); try { setItems(await request<ResponseItem[]>(`/api/itsm/canned-responses?groupId=${id}`)); } catch (error) { setItems([]); itsmNotify(error instanceof Error ? error.message : "دریافت پاسخ‌ها انجام نشد.", "err"); } finally { setLoading(false); } }
  useEffect(() => { if (groupId) void load(groupId); }, [groupId]);
  function reset() { setEditing(null); setTitle(""); setBody(""); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await request("/api/itsm/canned-responses", { method: "POST", body: JSON.stringify({ groupId, ...(editing ? { id: editing } : {}), title, body }) }); reset(); await load(groupId); itsmNotify("پاسخ آماده ذخیره شد."); }
    catch (error) { itsmNotify(error instanceof Error ? error.message : "ذخیره انجام نشد.", "err"); } finally { setBusy(false); }
  }
  async function remove(item: ResponseItem) {
    if (!(await ask(`پاسخ «${item.title}» حذف شود؟`))) return;
    setBusy(true);
    try { await request("/api/itsm/canned-responses", { method: "DELETE", body: JSON.stringify({ groupId, id: item.id }) }); if (editing === item.id) reset(); await load(groupId); itsmNotify("پاسخ آماده حذف شد."); }
    catch (error) { itsmNotify(error instanceof Error ? error.message : "حذف انجام نشد.", "err"); } finally { setBusy(false); }
  }
  return <><div className="itsm-heading"><div><h1>پاسخ‌های آماده واحد</h1><p>پاسخ‌هایی برای استفاده کارشناسان هنگام بستن تیکت تعریف کنید.</p></div></div>
    {dialogs}
    {!groups.length ? <section className="itsm-panel itsm-empty">برای مدیریت پاسخ‌ها باید عضو یک واحد فعال باشید.</section> : <div className="itsm-response-layout"><section className="itsm-panel itsm-form"><h2>{editing ? "ویرایش پاسخ" : "پاسخ جدید"}</h2><form onSubmit={save}><label className="itsm-reply">واحد<select value={groupId} onChange={(event) => { setItems([]); setGroupId(Number(event.target.value)); reset(); }} disabled={busy || loading}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="itsm-reply">عنوان پاسخ<input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً راه‌اندازی مجدد سیستم"/></label><label className="itsm-reply">متن پاسخ<textarea required maxLength={500} rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="متنی که به درخواست‌کننده نمایش داده می‌شود"/></label><div className="itsm-form-actions"><button className="itsm-primary" disabled={busy}>{editing ? "ذخیره تغییرات" : "ثبت پاسخ"}</button>{editing && <button type="button" className="itsm-secondary" onClick={reset}>انصراف از ویرایش</button>}</div></form></section><section className="itsm-panel"><h2>پاسخ‌های ثبت‌شده</h2>{loading ? <p>در حال دریافت پاسخ‌ها...</p> : !items.length ? <div className="itsm-empty">هنوز پاسخی برای این واحد ثبت نشده است.</div> : items.map((item) => <article className="itsm-response-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><div><button type="button" className="itsm-secondary" disabled={busy} onClick={() => { setEditing(item.id); setTitle(item.title); setBody(item.body); }}>ویرایش</button><button type="button" className="itsm-secondary" disabled={busy} onClick={() => void remove(item)}>حذف</button></div></article>)}</section></div>}
  </>;
}

export function ItsmCloseTicket({ ticketId, groupId, onDone }: { ticketId: number; groupId: number; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ResponseItem[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function show() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    try { setItems(await request<ResponseItem[]>(`/api/itsm/canned-responses?groupId=${groupId}`)); }
    catch (error) { setItems([]); itsmNotify(error instanceof Error ? error.message : "دریافت پاسخ‌ها انجام نشد.", "err"); }
  }
  async function close(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await request(`/api/itsm/tickets/${ticketId}/transition`, { method: "POST", body: JSON.stringify({ status: "closed", reason: body }) }); setOpen(false); itsmNotify("تیکت بسته شد."); await onDone(); }
    catch (error) { itsmNotify(error instanceof Error ? error.message : "بستن تیکت انجام نشد.", "err"); } finally { setBusy(false); }
  }
  return <div className="itsm-close-ticket"><button type="button" className="itsm-secondary" onClick={() => void show()} aria-expanded={open}>بستن تیکت</button>{open && <form className="itsm-repair-form" onSubmit={close}><label className="itsm-reply">انتخاب پاسخ آماده<select defaultValue="" onChange={(event) => { const item = items.find((response) => response.id === event.target.value); if (item) setBody(item.body); }}><option value="">انتخاب پاسخ (اختیاری)</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{!items.length && <p>برای این واحد پاسخ آماده‌ای در دسترس نیست؛ می‌توانید متن دلخواه بنویسید.</p>}<label className="itsm-reply">پاسخ نهایی برای درخواست‌کننده (اختیاری)<textarea rows={4} maxLength={500} value={body} onChange={(event) => setBody(event.target.value)}/></label><p>متن پاسخ در گفت‌وگوی تیکت ثبت می‌شود.</p><div className="itsm-response-actions"><button className="itsm-primary" disabled={busy}>ثبت و بستن تیکت</button><button type="button" className="itsm-secondary" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></div></form>}</div>;
}
