"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PortalIcon } from "@/components/PortalIcon";
import { IncomingTransfers, TransferTicketForm } from "@/components/ItsmTransfers";
import { ItsmTicketSla } from "@/components/ItsmTicketSla";
import { ItsmReportLink } from '@/components/ItsmReportLink';
import { ItsmSlaNotices } from "@/components/ItsmSlaNotices";
import { ItsmPauseTicket } from "@/components/ItsmPauseTicket";
import { ItsmNotifications } from "@/components/ItsmNotifications";
import { ItsmAssignTicket } from "@/components/ItsmAssignTicket";
import { ItsmReopenTicket } from "@/components/ItsmReopenTicket";
import { ItsmCannedResponses, ItsmCloseTicket } from "@/components/ItsmCannedResponses";
import { ItsmTicketDashboard } from "@/components/ItsmTicketDashboard";
import { ItsmTicketHistory } from "@/components/ItsmTicketHistory";
import { ItsmToasts, itsmNotify, useItsmDialogs } from "@/components/ItsmFeedback";
import { ItsmPriorityBadge } from "@/components/ItsmPriorityBadge";
import "@/styles/itsm-preview.css";

type Category = { id: number; name: string; groupName: string };
type Ticket = { kind?: string; id: number; groupId: number; title: string; status: string; category: string; group: string; createdAt: string; description?: string; contactExtension?: string | null; transferSource?: string | null; transferSender?: string | null; transferReason?: string | null; transferNote?: string | null; assetComputerName?: string; assetCpu?: string; assetRam?: string; assetHdd?: string; assetSsd?: string; assetVga?: string; assetIp?: string; assetNotes?: string; assetName?: string | null; assetCode?: string | null; assetSerial?: string | null; assetBrand?: string | null; assetModel?: string | null; assigneeName?: string | null; assignedBySupervisor?: boolean; isAssignee?: boolean; isParticipant?: boolean; isQueueViewer?: boolean; isForOther?: boolean; requesterName?: string; beneficiaryName?: string; requesterUnit?: string | null; beneficiaryUnit?: string | null; priority?: string | null; sla?: string };
type Identity = { employee: { firstName: string; lastName: string }; groups: { id: number; name: string }[]; roles: string[]; canBootstrapManager: boolean };
type Message = { id: number; body: string; internal: boolean; firstName: string; lastName: string; createdAt: string };
type Person = { id: number; firstName: string; lastName: string; code: string };
type Attachment = { id: number; filename: string; size: number };
type TicketAsset = { id: number; kind: "warehouse" | "personal"; name: string; code: string; serial: string; brand: string; model: string };
const labels: Record<string, string> = { waiting_assignment: "در انتظار تخصیص", in_progress: "در حال انجام", waiting_user: "در انتظار پاسخ", waiting_action: "در انتظار اقدام", resolved: "حل‌شده", closed: "بسته‌شده", cancelled: "لغوشده" };
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "عملیات انجام نشد.");
  return result as T;
}

export default function ItsmWorkspace() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [view, setView] = useState("tickets");
  const [detailsOrigin, setDetailsOrigin] = useState("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [contactExtension, setContactExtension] = useState("");
  const [requestKind, setRequestKind] = useState("incident");
  const [categoryId, setCategoryId] = useState(""); const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const { ask, askText, dialogs } = useItsmDialogs();
  const [peopleQuery, setPeopleQuery] = useState(""); const [people, setPeople] = useState<Person[]>([]); const [beneficiary, setBeneficiary] = useState<Person | null>(null);
  const [forOther, setForOther] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<TicketAsset[]>([]);
  const [assetId, setAssetId] = useState(""); const [assetError, setAssetError] = useState(""); const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetReload, setAssetReload] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [initialAttachment, setInitialAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [transferCount, setTransferCount] = useState<number | null>(null);
  const canSeeQueue = !!identity?.roles.some((role) => ["technician", "group_head"].includes(role));
  const canSeeTransfers = !!identity?.roles.some((role) => ["group_head", "it_manager"].includes(role));
  const refreshQueueCount = useCallback(async () => {
    try { const result = await api<{ count: number }>("/api/itsm/queue/count"); setQueueCount(result.count); }
    catch { setQueueCount(null); }
  }, []);
  const refreshTransferCount = useCallback(async () => {
    try { const result = await api<{ count: number }>("/api/itsm/transfers/count"); setTransferCount(result.count); }
    catch { setTransferCount(null); }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [me, choices, list] = await Promise.all([api<Identity>("/api/itsm/me"), api<Category[]>("/api/itsm/categories"), view === "queue" ? api<Ticket[]>("/api/itsm/queue") : view === "all" ? api<Ticket[]>("/api/itsm/tickets?view=all") : Promise.resolve([] as Ticket[])]);
      setIdentity(me); setCategories(choices); setTickets(list);
    } catch (error) { itsmNotify(error instanceof Error ? error.message : "دریافت اطلاعات ممکن نشد.", "err"); }
    finally { setLoading(false); }
  }, [view]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!canSeeQueue) { setQueueCount(null); return; }
    void refreshQueueCount();
    const timer = window.setInterval(() => { void refreshQueueCount(); }, 15000);
    const onFocus = () => { void refreshQueueCount(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [canSeeQueue, refreshQueueCount]);
  useEffect(() => {
    if (!canSeeTransfers) { setTransferCount(null); return; }
    void refreshTransferCount();
    const timer = window.setInterval(() => { void refreshTransferCount(); }, 15000);
    const onFocus = () => { void refreshTransferCount(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [canSeeTransfers, refreshTransferCount]);
  useEffect(() => {
    if (view !== "queue") return;
    let live = true;
    const update = () => { void api<Ticket[]>("/api/itsm/queue").then((list) => { if (live) setTickets(list); }).catch(() => {}); };
    const timer = window.setInterval(update, 15000);
    return () => { live = false; window.clearInterval(timer); };
  }, [view]);
  useEffect(() => {
    if (!forOther || peopleQuery.trim().length < 2 || beneficiary) { setPeople([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => { void api<Person[]>(`/api/itsm/people?q=${encodeURIComponent(peopleQuery)}`, { signal: controller.signal }).then(setPeople).catch(() => {}); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [peopleQuery, beneficiary, forOther]);
  useEffect(() => {
    setAssetId(""); setAvailableAssets([]); setAssetError("");
    if (view !== "new" || (forOther && !beneficiary)) { setAssetsLoading(false); return; }
    const controller = new AbortController();
    setAssetsLoading(true);
    const query = beneficiary && forOther ? `?beneficiaryId=${beneficiary.id}` : "";
    void api<TicketAsset[]>(`/api/itsm/ticket-assets${query}`, { signal: controller.signal }).then(setAvailableAssets).catch((error) => { if (!controller.signal.aborted) setAssetError(error instanceof Error ? error.message : "دریافت دارایی‌ها ممکن نشد."); }).finally(() => { if (!controller.signal.aborted) setAssetsLoading(false); });
    return () => controller.abort();
  }, [view, forOther, beneficiary, assetReload]);
  async function openTicket(id: number) {
    try { const [ticket, conversation, files] = await Promise.all([api<Ticket>(`/api/itsm/tickets/${id}`), api<Message[]>(`/api/itsm/tickets/${id}/messages`), api<Attachment[]>(`/api/itsm/tickets/${id}/attachments`)]); setSelected(ticket); setMessages(conversation); setAttachments(files); setView("details"); }
    catch (error) { itsmNotify(error instanceof Error ? error.message : "درخواست باز نشد.", "err"); }
  }
  async function post(path: string, data: object) { return api(path, { method: "POST", body: JSON.stringify(data) }); }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (forOther && !beneficiary) { itsmNotify("ابتدا همکار مورد نظر را انتخاب کنید.", "err"); return; }
    if (assetsLoading || assetError) { itsmNotify("ابتدا دریافت دارایی‌ها را کامل کنید.", "err"); return; }
    if (availableAssets.length && !assetId) { itsmNotify("دارایی مرتبط را انتخاب کنید.", "err"); return; }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("kind", requestKind); form.append("title", title); form.append("description", description); form.append("contactExtension", contactExtension); form.append("categoryId", categoryId);
      if (forOther && beneficiary) form.append("beneficiaryId", String(beneficiary.id));
      if (assetId) { const [kind, id] = assetId.split(":"); form.append(kind === "personal" ? "personalAssetId" : "assetId", id); }
      if (initialAttachment) form.append("file", initialAttachment);
      const response = await fetch("/api/itsm/tickets", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ثبت انجام نشد.");
      setTitle(""); setDescription(""); setContactExtension(""); setInitialAttachment(null); setBeneficiary(null); setForOther(false); setAssetId(""); setPeopleQuery(""); itsmNotify("درخواست ثبت شد."); await openTicket(result.id);
    }
    catch (error) { itsmNotify(error instanceof Error ? error.message : "ثبت انجام نشد.", "err"); }
    finally { setSubmitting(false); }
  }
  async function claim(id: number) { try { await post(`/api/itsm/tickets/${id}/claim`, {}); itsmNotify("تیکت به شما تخصیص یافت."); await openTicket(id); } catch (error) { itsmNotify(error instanceof Error ? error.message : "برداشتن تیکت ممکن نشد.", "err"); await refresh(); } finally { await refreshQueueCount(); if (canSeeTransfers) await refreshTransferCount(); } }
  async function sendMessage(event: React.FormEvent) { event.preventDefault(); if (!selected) return; try { await post(`/api/itsm/tickets/${selected.id}/messages`, { body: message, internal }); setMessage(""); itsmNotify("پیام ثبت شد."); await openTicket(selected.id); } catch (error) { itsmNotify(error instanceof Error ? error.message : "ثبت پیام ممکن نشد.", "err"); } }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file || !selected) return; try { const form = new FormData(); form.append("file", file); const response = await fetch(`/api/itsm/tickets/${selected.id}/attachments`, { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error); itsmNotify("پیوست ثبت شد."); await openTicket(selected.id); } catch (error) { itsmNotify(error instanceof Error ? error.message : "ثبت پیوست ممکن نشد.", "err"); } }
  async function changeStatus(status: string) { if (!selected) return; let reason = ""; if (status === "cancelled") { const value = await askText({ title: "دلیل لغو درخواست را بنویسید", placeholder: "این دلیل در تاریخچه تیکت ثبت می‌شود…", minWords: 2 }); if (value === null) return; reason = value; } else if (status === "resolved" && !(await ask("تیکت به‌عنوان حل‌شده اعلام شود؟ درخواست‌کننده می‌تواند در صورت نیاز آن را بازگرداند."))) return; try { await post(`/api/itsm/tickets/${selected.id}/transition`, { status, reason }); itsmNotify("وضعیت تغییر کرد."); await openTicket(selected.id); } catch (error) { itsmNotify(error instanceof Error ? error.message : "تغییر وضعیت ممکن نشد.", "err"); } }
  return <div className="itsm-preview" dir="rtl"><aside className="itsm-sidebar"><div className="itsm-brand"><span className="itsm-brand-icon"><PortalIcon name="tool"/></span><div><strong>مرکز خدمات فناوری اطلاعات</strong><small>پرتال آپادانا</small></div></div><div className="itsm-menu-label">میز کار</div><nav><button className={view === "tickets" ? "active" : ""} onClick={() => setView("tickets")}><PortalIcon name="ticket"/>تیکت‌های من</button><button className={view === "new" ? "active" : ""} onClick={() => setView("new")}><PortalIcon name="doc"/>ثبت درخواست</button>{identity?.roles.includes("it_manager") && <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}><PortalIcon name="ticket"/>همه تیکت‌ها</button>}{identity?.roles.some((role) => ["technician", "group_head"].includes(role)) && <button className={view === "queue" ? "active" : ""} onClick={() => setView("queue")}><PortalIcon name="users"/>صف واحد{queueCount !== null && queueCount > 0 && <span className="itsm-queue-count" aria-label={`${queueCount.toLocaleString("fa-IR")} تیکت در صف`}>{queueCount.toLocaleString("fa-IR")}</span>}</button>}{identity?.roles.some((role) => ["group_head", "it_manager"].includes(role)) && <button className={view === "transfers" ? "active" : ""} onClick={() => { setView("transfers"); void refreshTransferCount(); }}><PortalIcon name="users"/>ارجاع‌های ورودی{transferCount !== null && transferCount > 0 && <span className="itsm-queue-count" aria-label={`${transferCount.toLocaleString("fa-IR")} ارجاع ورودی در انتظار بررسی`}>{transferCount.toLocaleString("fa-IR")}</span>}</button>}{identity?.roles.includes("group_head") && <button className={view === "responses" ? "active" : ""} onClick={() => setView("responses")}><PortalIcon name="doc"/>پاسخ‌های آماده</button>}{identity?.roles.some((role) => ["technician", "group_head", "it_manager"].includes(role)) && <Link className="itsm-asset-nav" href="/tickets/personal-assets">تجهیزات کاربران</Link>}<Link className="itsm-asset-nav" href="/tickets/assets">تجهیزات واحد و انبار</Link><ItsmReportLink/><ItsmSlaNotices onOpen={openTicket}/></nav>{(identity?.canBootstrapManager || identity?.roles.includes("it_manager")) && <Link className="itsm-back" href="/tickets/settings">تنظیمات و دسترسی‌ها</Link>}<Link className="itsm-back" href="/">← بازگشت به پرتال</Link></aside><main className="itsm-main"><header className="itsm-topbar"><div className="itsm-header-start"><ItsmNotifications onOpenTicket={(id) => void openTicket(id)} onOpenQueue={() => setView("queue")}/><strong>مرکز خدمات فناوری اطلاعات</strong></div><span>{identity ? `${identity.employee.firstName} ${identity.employee.lastName}` : "در حال دریافت هویت"}</span></header><div className="itsm-content"><ItsmToasts/>{dialogs}{loading ? <p>در حال دریافت اطلاعات...</p> : <>
    {view === "tickets" && <ItsmTicketDashboard canWork={canSeeQueue} onCreate={() => setView("new")} onOpen={(id) => { setDetailsOrigin("tickets"); void openTicket(id); }}/>}
    {(view === "queue" || view === "all") && <><div className="itsm-heading"><div><h1>{view === "queue" ? "صف واحد" : "تیکت‌های من"}</h1><p>درخواست‌ها و روند رسیدگی را دنبال کنید.</p></div><button className="itsm-primary" onClick={() => setView("new")}>+ درخواست جدید</button></div><section className="itsm-panel"><div className="itsm-result">{tickets.length.toLocaleString("fa-IR")} درخواست</div>{tickets.length ? tickets.map((ticket) => <div className="itsm-ticket-row" key={ticket.id}><button className="itsm-ticket-main" onClick={() => { setDetailsOrigin(view); void openTicket(ticket.id); }}><span className="itsm-ticket-icon"><PortalIcon name="ticket"/></span><span><strong>{ticket.title}</strong><small>#{ticket.id.toLocaleString("fa-IR")} · {ticket.category} · {ticket.group}</small>{view === "queue" && <><small>ثبت‌کننده: {ticket.requesterName} · واحد: {ticket.requesterUnit || "ثبت نشده"}</small>{ticket.isForOther && <small>برای: {ticket.beneficiaryName} · واحد: {ticket.beneficiaryUnit || "ثبت نشده"}</small>}<small>تاریخ ثبت: {dateTime(ticket.createdAt)}</small></>}</span></button>{ticket.transferSource && <span className="itsm-transfer-badge">ارجاع از {ticket.transferSource} · {ticket.transferSender}</span>}{ticket.assignedBySupervisor && <span className="itsm-assigned-badge">انتصاب مدیر / سرپرست</span>}<ItsmPriorityBadge priority={ticket.priority} sla={ticket.sla}/><span className="itsm-badge">{labels[ticket.status] || "در انتظار تخصیص"}</span>{view === "queue" && <button className="itsm-secondary" onClick={() => claim(ticket.id)}>برداشتن</button>}</div>) : <div className="itsm-empty">درخواستی وجود ندارد.</div>}</section></>}
    {view === "new" && <><div className="itsm-heading"><h1>ثبت درخواست جدید</h1></div><form className="itsm-panel itsm-form" onSubmit={create}><div className="itsm-form-grid"><label>نوع درخواست<select value={requestKind} onChange={event => setRequestKind(event.target.value)}><option value="incident">خرابی و مشکل</option><option value="service">درخواست خدمت</option></select></label><label>دسته‌بندی<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">انتخاب کنید</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>واحد رسیدگی<input readOnly value={categories.find((category) => String(category.id) === categoryId)?.groupName ?? ""}/></label><label className="itsm-full">شماره داخلی تماس *<input required inputMode="numeric" maxLength={10} pattern="[0-9۰-۹٠-٩]{1,10}" value={contactExtension} onChange={(event) => setContactExtension(event.target.value)} placeholder="شماره داخلی برای تماس کارشناس"/><small>شماره داخلی فردی را وارد کنید که کارشناس با او تماس بگیرد.</small></label><label className="itsm-full">عنوان<input required minLength={3} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)}/></label><label className="itsm-full">شرح درخواست<textarea required minLength={3} maxLength={10000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)}/></label><label className="itsm-full">فایل پیوست (اختیاری)<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" onChange={(event) => setInitialAttachment(event.target.files?.[0] ?? null)}/><small>PDF، تصویر، Word یا Excel؛ حداکثر ۵ مگابایت.</small></label></div><div className="itsm-recipient"><label className="itsm-check"><input type="checkbox" checked={forOther} onChange={(event) => { setForOther(event.target.checked); setBeneficiary(null); setPeopleQuery(""); setPeople([]); }}/> این درخواست برای فرد دیگری است</label>{forOther && <div className="itsm-reply"><label>انتخاب همکار <input required={!beneficiary} value={beneficiary ? `${beneficiary.firstName} ${beneficiary.lastName} · ${beneficiary.code}` : peopleQuery} onChange={(event) => { setBeneficiary(null); setPeopleQuery(event.target.value); }} placeholder="نام، نام خانوادگی یا کد پرسنلی"/></label>{!beneficiary && people.map((person) => <button type="button" className="itsm-secondary" key={person.id} onClick={() => { setBeneficiary(person); setPeople([]); }}>{person.firstName} {person.lastName} · {person.code}</button>)}<small>همکار را از نتایج انتخاب کنید.</small></div>}</div>{assetError && <div role="alert">{assetError} <button type="button" className="itsm-secondary" onClick={() => setAssetReload(value => value + 1)}>تلاش دوباره</button></div>}{!assetsLoading && !assetError && (!forOther || beneficiary) && availableAssets.length > 0 && <label className="itsm-reply">دارایی مرتبط *<select required value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">انتخاب دارایی</option>{availableAssets.map((asset) => <option key={`${asset.kind}:${asset.id}`} value={`${asset.kind}:${asset.id}`}>{asset.name}{asset.code ? ` · ${asset.code}` : ""}{asset.serial ? ` · سریال ${asset.serial}` : ""}</option>)}</select><small>دارایی مربوط به این درخواست را انتخاب کنید.</small></label>}<div className="itsm-form-actions"><button className="itsm-primary" disabled={!categories.length || submitting || assetsLoading || !!assetError || (forOther && !beneficiary)}>{submitting ? "در حال ثبت…" : "ثبت درخواست"}</button></div>{!categories.length && <p>هنوز دسته‌بندی فعالی تنظیم نشده است.</p>}</form></>}
    {view === "details" && selected && <><div className="itsm-heading"><div><span className="itsm-eyebrow">تیکت #{selected.id}</span><h1>{selected.title}</h1></div><button className="itsm-secondary" onClick={() => setView(detailsOrigin)}>بازگشت</button></div><section className="itsm-panel"><span className="itsm-badge">{labels[selected.status]}</span><ItsmPriorityBadge priority={selected.priority} sla={selected.sla}/>{selected.transferSource && <span className="itsm-transfer-badge itsm-assigned-detail">ارجاع از {selected.transferSource} · {selected.transferSender}</span>}{selected.assignedBySupervisor && <span className="itsm-assigned-badge itsm-assigned-detail">انتصاب مدیر / سرپرست</span>}<div className="itsm-ticket-meta"><div><span>ثبت‌کننده</span><strong>{selected.requesterName || "—"}</strong><small>{selected.requesterUnit || "واحد ثبت نشده"}</small></div>{selected.isForOther && <div><span>درخواست برای</span><strong>{selected.beneficiaryName || "—"}</strong><small>{selected.beneficiaryUnit || "واحد ثبت نشده"}</small></div>}<div><span>نوع درخواست</span><strong>{selected.kind === "service" ? "درخواست خدمت" : "خرابی و مشکل"}</strong></div><div><span>دسته‌بندی و واحد رسیدگی</span><strong>{selected.category} · {selected.group}</strong></div><div><span>تاریخ و ساعت ثبت</span><strong>{dateTime(selected.createdAt)}</strong></div><div><span>کارشناس رسیدگی</span><strong>{selected.assigneeName || "تخصیص نیافته"}</strong></div></div>{selected.assetName && <div className="itsm-asset-ticket"><strong>دارایی مرتبط: {selected.assetName}</strong><span>{selected.assetComputerName ? `نام رایانه: ${selected.assetComputerName}` : selected.assetCode ? `کد دارایی: ${selected.assetCode}` : ""}{selected.assetSerial ? ` · سریال: ${selected.assetSerial}` : ""}{selected.assetBrand || selected.assetModel ? ` · ${[selected.assetBrand, selected.assetModel].filter(Boolean).join(" ")}` : ""}</span>{[selected.assetCpu && `CPU: ${selected.assetCpu}`,selected.assetRam && `RAM: ${selected.assetRam}`,selected.assetHdd && `HDD: ${selected.assetHdd}`,selected.assetSsd && `SSD: ${selected.assetSsd}`,selected.assetVga && `VGA: ${selected.assetVga}`,selected.assetIp && `IP: ${selected.assetIp}`].filter(Boolean).join(" · ")}{selected.assetNotes && <span>{selected.assetNotes}</span>}</div>}<p className="itsm-description">{selected.description}</p><p><strong>شماره داخلی تماس: </strong><span dir="ltr">{selected.contactExtension || "ثبت نشده"}</span></p>{selected.status === "waiting_assignment" && (identity?.roles.includes("it_manager") || (selected.isQueueViewer && identity?.roles.includes("group_head"))) && <ItsmAssignTicket key={selected.id} ticketId={selected.id} onAssigned={() => { itsmNotify("تیکت به کارشناس انتخاب‌شده اختصاص یافت."); setView("tickets"); void refreshQueueCount(); void refreshTransferCount(); }}/>}<div className="itsm-form-actions">{selected.isQueueViewer && <button className="itsm-primary" onClick={() => void claim(selected.id)}>برداشتن تیکت</button>}{selected.isAssignee && selected.status === "in_progress" && <><ItsmPauseTicket ticketId={selected.id} onDone={()=>openTicket(selected.id)}/><button className="itsm-secondary" onClick={() => changeStatus("resolved")}>حل‌شده</button><ItsmCloseTicket key={selected.id} ticketId={selected.id} groupId={selected.groupId} onDone={() => openTicket(selected.id)}/></>}{selected.isAssignee && selected.status === "resolved" && <ItsmCloseTicket key={selected.id} ticketId={selected.id} groupId={selected.groupId} onDone={() => openTicket(selected.id)}/>}{selected.isParticipant && selected.status === "resolved" && <ItsmReopenTicket ticketId={selected.id} onDone={() => openTicket(selected.id)}/>} {selected.isParticipant && !selected.isAssignee && !["closed", "cancelled"].includes(selected.status) && <button className="itsm-secondary" onClick={() => changeStatus("cancelled")}>لغو درخواست</button>}</div>{selected.isAssignee && ["in_progress", "waiting_user", "waiting_action"].includes(selected.status) && <TransferTicketForm key={selected.id} ticketId={selected.id} groupId={selected.groupId} onComplete={() => { itsmNotify("تیکت به مقصد انتخاب‌شده ارجاع شد."); setView("tickets"); }}/>}{selected.transferReason && <div className="itsm-transfer-reason"><strong>دلیل ارجاع:</strong> {selected.transferReason}{selected.transferNote && <p>{selected.transferNote}</p>}</div>}<ItsmTicketSla key={`${selected.id}-${selected.status}-${messages.length}`} ticketId={selected.id} canEdit={!!selected.isAssignee} onChange={()=>openTicket(selected.id)}/><div className="itsm-divider"/><h2>پیوست‌ها</h2>{!attachments.length && <p>فایل پیوستی ثبت نشده است.</p>}{attachments.map((file) => <p key={file.id}><a href={`/api/itsm/tickets/${selected.id}/attachments/${file.id}`}>{file.filename}</a> · {Math.ceil(file.size / 1024).toLocaleString("fa-IR")} کیلوبایت</p>)}{(selected.isAssignee ? ["in_progress", "waiting_user"] : selected.isParticipant ? ["waiting_assignment", "waiting_user"] : []).includes(selected.status) && <label className="itsm-reply">افزودن پیوست (حداکثر ۵ مگابایت)<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" onChange={upload}/></label>}<ItsmTicketHistory key={`${selected.id}-${selected.status}-${messages.length}`} ticketId={selected.id}/><div className="itsm-divider"/><h2>گفت‌وگو</h2>{messages.map((item) => <div className="itsm-message" key={item.id}><strong>{item.firstName} {item.lastName} {item.internal && "· یادداشت داخلی"}</strong><small>{dateTime(item.createdAt)}</small><p>{item.body}</p></div>)}{(selected.isAssignee || (selected.isParticipant && selected.status === "waiting_user")) && !["closed", "cancelled", "resolved"].includes(selected.status) && <form onSubmit={sendMessage}><label className="itsm-reply">پیام<textarea required maxLength={10000} value={message} onChange={(event) => setMessage(event.target.value)}/></label>{selected.isAssignee && <label className="itsm-check"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)}/> یادداشت داخلی</label>}<button className="itsm-primary">ارسال پیام</button></form>}</section></>}
    {view === "transfers" && <IncomingTransfers onChanged={() => { void refreshTransferCount(); void refreshQueueCount(); }}/>}
    {view === "responses" && identity?.roles.includes("group_head") && <ItsmCannedResponses groups={identity.groups}/>}
  </>}</div></main></div>;
}
const dateTime = (value: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value));
