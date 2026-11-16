"use client";

import { useEffect, useState } from "react";
import { ItsmSatisfaction } from "@/components/ItsmSatisfaction";

type Entry = { id: number; label: string; actorName: string; createdAt: string };
const dateTime = (value: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value));

export function ItsmTicketHistory({ ticketId }: { ticketId: number }) {
  const [items, setItems] = useState<Entry[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/itsm/tickets/${ticketId}/history`, { cache: "no-store", signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "تاریخچه دریافت نشد."); setItems(data); }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "تاریخچه دریافت نشد."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ticketId]);
  return <><ItsmSatisfaction ticketId={ticketId}/><section className="itsm-history"><div className="itsm-divider"/><h2>تاریخچه رسیدگی</h2>{loading ? <p>در حال دریافت تاریخچه...</p> : error ? <p role="alert">{error}</p> : !items.length ? <p>هنوز رویدادی ثبت نشده است.</p> : <ol>{items.map((item) => <li key={item.id}><span className="itsm-history-dot"/><div><strong>{item.label}</strong><small>{item.actorName} · {dateTime(item.createdAt)}</small></div></li>)}</ol>}</section></>;
}
