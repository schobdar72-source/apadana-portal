"use client";

import { useEffect, useState } from "react";
import { itsmNotify, useItsmDialogs } from "@/components/ItsmFeedback";

type Group = { id: number; name: string };
type Person = { id: number; firstName: string; lastName: string; code: string; positionTitle: string | null; groupId: number; groupName: string };
type Transfer = { id: number; ticketId: number; title: string; reason: string; note: string; source: string; destination: string };
async function call<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "عملیات انجام نشد.");
  return data as T;
}

export function TransferTicketForm({ ticketId, groupId, onComplete }: { ticketId: number; groupId: number; onComplete: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [destination, setDestination] = useState(""); const [person, setPerson] = useState(""); const [reason, setReason] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; call<{ groups: Group[]; people: Person[] }>(`/api/itsm/tickets/${ticketId}/transfer`).then((data) => { if (active) { setGroups(data.groups); setPeople(data.people); } }).catch((failure) => { if (active) setError(failure.message); }); return () => { active = false; }; }, [ticketId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    if (reason.trim().length < 6 || reason.trim().split(/\s+/).length < 2) { setBusy(false); setError("دلیل ارجاع را در حداقل دو کلمه بنویسید."); return; }
    try { await call(`/api/itsm/tickets/${ticketId}/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinationGroupId: Number(destination), destinationEmployeeId: person ? Number(person) : null, reason }) }); onComplete(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "ارجاع انجام نشد."); }
    finally { setBusy(false); }
  }
  return <form className="itsm-reply" onSubmit={submit}><div className="itsm-divider"/><h2>ارجاع برای ادامه رسیدگی</h2><p>تیکت را به صف یک واحد دیگر یا مستقیم به کارشناس انتخاب‌شده بسپارید.</p><label>واحد مقصد<select required value={destination} onChange={(event) => { setDestination(event.target.value); setPerson(""); }}><option value="">انتخاب کنید</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>کارشناس مقصد<select value={person} onChange={(event) => setPerson(event.target.value)} disabled={!destination}><option value="">{Number(destination) === groupId ? "انتخاب کارشناس الزامی است" : "صف واحد (بدون انتخاب کارشناس)"}</option>{people.filter((item) => item.groupId === Number(destination)).map((item) => <option key={`${item.groupId}-${item.id}`} value={item.id}>{item.firstName} {item.lastName} · {item.positionTitle || "کارشناس"} · {item.groupName} · {item.code}</option>)}</select></label><label>دلیل ارجاع (الزامی)<textarea required minLength={6} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="کار انجام‌شده و دلیل نیاز به ادامه رسیدگی را بنویسید"/></label>{error && <p role="alert">{error}</p>}<button className="itsm-secondary" disabled={busy || !destination || (Number(destination) === groupId && !person)}>{busy ? "در حال ارجاع…" : "ارجاع تیکت"}</button></form>;
}

export function IncomingTransfers({ onChanged }: { onChanged: () => void }) {
  const [transfers, setTransfers] = useState<Transfer[]>([]); const [busy, setBusy] = useState<number | null>(null);
  const { askText, dialogs } = useItsmDialogs();
  async function refresh() { try { setTransfers(await call<Transfer[]>("/api/itsm/transfers")); } catch (failure) { itsmNotify(failure instanceof Error ? failure.message : "دریافت ارجاع‌ها ممکن نشد.", "err"); } }
  useEffect(() => { void refresh(); }, []);
  async function decide(id: number, decision: "accept" | "reject") {
    let reason = "";
    if (decision === "reject") { const value = await askText({ title: "دلیل رد ارجاع را بنویسید", placeholder: "این دلیل برای واحد مبدأ ثبت می‌شود…", minWords: 2 }); if (value === null) return; reason = value; }
    setBusy(id);
    try { await call(`/api/itsm/transfers/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason }) }); itsmNotify(decision === "accept" ? "ارجاع پذیرفته شد." : "ارجاع رد شد."); await refresh(); }
    catch (failure) { itsmNotify(failure instanceof Error ? failure.message : "تصمیم ثبت نشد.", "err"); await refresh(); }
    finally { setBusy(null); onChanged(); }
  }
  return <><div className="itsm-heading"><div><h1>ارجاع‌های ورودی</h1><p>ارجاع‌های بررسی‌نشده واحد را بپذیرید یا با دلیل رد کنید.</p></div></div><section className="itsm-panel">{dialogs}{transfers.length === 0 ? <div className="itsm-empty">ارجاع بررسی‌نشده‌ای وجود ندارد.</div> : transfers.map((item) => <div className="itsm-ticket-row" key={item.id}><div className="itsm-ticket-main"><span><strong>{item.title} · #{item.ticketId.toLocaleString("fa-IR")}</strong><small>{item.source} ← {item.destination} · {item.reason}{item.note ? ` · ${item.note}` : ""}</small></span></div><button className="itsm-primary" disabled={busy === item.id} onClick={() => decide(item.id, "accept")}>پذیرش</button><button className="itsm-secondary" disabled={busy === item.id} onClick={() => decide(item.id, "reject")}>رد ارجاع</button></div>)}<p>با برداشتن تیکت از صف، ارجاع به صورت خودکار پذیرفته می‌شود.</p></section></>;
}
