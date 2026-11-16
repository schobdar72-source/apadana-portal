"use client";

import { useEffect, useState } from "react";
import { ItsmPriorityBadge } from "@/components/ItsmPriorityBadge";

type Ticket = { id: number; title: string; status: string; category: string; group: string; createdAt: string; requesterName: string; beneficiaryName: string; isForOther: boolean; assigneeName: string | null; assetName: string | null; assetCode: string | null; transferSource: string | null; transferSender: string | null; assignedBySupervisor: boolean; isAssignee: boolean; isParticipant: boolean; priority: string | null; sla: string };
type Data = { counts: { total: number; active: number; waiting: number; done: number; cancelled: number }; total: number; page: number; pageSize: number; tickets: Ticket[] };
const labels: Record<string, string> = { waiting_assignment: "در انتظار تخصیص", in_progress: "در حال انجام", waiting_user: "در انتظار پاسخ", waiting_action: "در انتظار اقدام", resolved: "حل‌شده", closed: "بسته‌شده", cancelled: "لغوشده" };
const cards = [{ id: "all", label: "کل تیکت‌ها", count: "total" }, { id: "active", label: "در جریان", count: "active" }, { id: "waiting", label: "در انتظار", count: "waiting" }, { id: "done", label: "حل‌شده و بسته", count: "done" }, { id: "cancelled", label: "لغوشده", count: "cancelled" }] as const;
const dateTime = (value: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value));

export function ItsmTicketDashboard({ canWork, onOpen, onCreate }: { canWork: boolean; onOpen: (id: number) => void; onCreate: () => void }) {
  const [scope, setScope] = useState("all"), [status, setStatus] = useState("all"), [query, setQuery] = useState(""), [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    async function load(initial: boolean) {
      if (initial) setLoading(true);
      try {
        const params = new URLSearchParams({ scope, status, q: query, page: String(page) });
        const response = await fetch(`/api/itsm/dashboard?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "دریافت تیکت‌ها ممکن نشد.");
        if (active) { setData(result); setError(""); }
      } catch (failure) { if (active && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "دریافت تیکت‌ها ممکن نشد."); }
      finally { if (active && initial) setLoading(false); }
    }
    const debounce = window.setTimeout(() => void load(true), query ? 250 : 0);
    const timer = window.setInterval(() => void load(false), 30000);
    return () => { active = false; window.clearTimeout(debounce); window.clearInterval(timer); controller.abort(); };
  }, [scope, status, query, page, reload]);
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 15)));
  return <><div className="itsm-heading"><div><h1>داشبورد تیکت‌های من</h1><p>نمایی از وضعیت و روند رسیدگی به درخواست‌های شما</p></div><button className="itsm-primary" onClick={onCreate}>+ درخواست جدید</button></div>
    {canWork && <div className="itsm-dashboard-scopes" aria-label="محدوده تیکت‌ها">{[{ id: "all", name: "همه تیکت‌های من" }, { id: "assigned", name: "کارهای ارجاع‌شده به من" }, { id: "requested", name: "درخواست‌های من" }].map((item) => <button key={item.id} type="button" className={scope === item.id ? "active" : ""} aria-pressed={scope === item.id} onClick={() => { setScope(item.id); setPage(1); }}>{item.name}</button>)}</div>}
    <div className="itsm-dashboard-cards">{cards.map((card) => <button key={card.id} type="button" className={`itsm-dashboard-card ${status === card.id ? "active" : ""}`} aria-pressed={status === card.id} onClick={() => { setStatus(card.id); setPage(1); }}><span>{card.label}</span><strong>{data ? data.counts[card.count].toLocaleString("fa-IR") : "—"}</strong></button>)}</div>
    <section className="itsm-panel"><div className="itsm-dashboard-list-head"><div><h2>فهرست تیکت‌ها</h2><p>برای مشاهده جزئیات و تاریخچه روی تیکت بزنید.</p></div><button type="button" className="itsm-secondary" onClick={() => setReload((value) => value + 1)}>به‌روزرسانی</button></div><label className="itsm-dashboard-search">جست‌وجو<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="شماره، عنوان، نام همکار یا دسته‌بندی"/></label>{error && <p role="alert">{error}</p>}{loading ? <div className="itsm-empty">در حال دریافت تیکت‌ها...</div> : !data?.tickets.length ? <div className="itsm-empty">تیکتی با این مشخصات پیدا نشد.</div> : <><div className="itsm-result">{data.total.toLocaleString("fa-IR")} تیکت</div>{data.tickets.map((ticket) => <button type="button" className="itsm-dashboard-ticket" key={ticket.id} onClick={() => onOpen(ticket.id)}><span className="itsm-dashboard-ticket-main"><strong>{ticket.title}</strong><small>#{ticket.id.toLocaleString("fa-IR")} · {ticket.category} · {ticket.group}</small><small>ثبت‌کننده: {ticket.requesterName}{ticket.isForOther ? ` · برای: ${ticket.beneficiaryName}` : ""} · کارشناس: {ticket.assigneeName || "تخصیص نیافته"}</small>{ticket.assetName && <small>دارایی: {ticket.assetName} · {ticket.assetCode}</small>}<small>ثبت: {dateTime(ticket.createdAt)}</small></span><span className="itsm-dashboard-ticket-tags"><ItsmPriorityBadge priority={ticket.priority} sla={ticket.sla}/>{ticket.transferSource && <span className="itsm-transfer-badge">ارجاع از {ticket.transferSource} · {ticket.transferSender}</span>}{ticket.assignedBySupervisor && <span className="itsm-assigned-badge">انتصاب مدیر / سرپرست</span>}{ticket.isAssignee && <span className="itsm-dashboard-role">مسئول رسیدگی</span>}<span className="itsm-badge">{labels[ticket.status] || ticket.status}</span></span></button>)}<div className="itsm-dashboard-pagination"><button className="itsm-secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>صفحه قبل</button><span>صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}</span><button className="itsm-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>صفحه بعد</button></div></>}</section>
  </>;
}
