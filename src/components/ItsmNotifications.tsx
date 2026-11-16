"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PortalIcon } from "@/components/PortalIcon";

type Notice = { id: number; kind: string; ticketId: number | null; title: string; detail: string; createdAt: string; read: boolean; destination: string };
type Feed = { items: Notice[]; unreadCount: number };

export function ItsmNotifications({ onOpenTicket, onOpenQueue }: { onOpenTicket: (id: number) => void; onOpenQueue: () => void }) {
  const [feed, setFeed] = useState<Feed>({ items: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [error, setError] = useState("");
  const known = useRef<Set<string> | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/itsm/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const next: Feed = await response.json();
      if (known.current && "Notification" in window && Notification.permission === "granted") {
        const incoming = next.items.filter((item) => !item.read && !known.current!.has(`${item.kind}:${item.id}`));
        if (incoming.length) {
          try {
            const notification = new Notification("اعلان جدید مرکز خدمات فناوری اطلاعات", { body: incoming.length === 1 ? incoming[0].title : `${incoming.length.toLocaleString("fa-IR")} اعلان جدید دارید.`, tag: "itsm-new-notice" });
            notification.onclick = () => { window.focus(); setOpen(true); notification.close(); };
          } catch {}
        }
      }
      known.current = new Set(next.items.map((item) => `${item.kind}:${item.id}`));
      setFeed(next); setError("");
    } catch { setError("دریافت اعلان‌ها ممکن نشد؛ دوباره تلاش می‌شود."); }
    finally { inFlight.current = false; }
  }, []);
  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    const focus = () => void refresh();
    const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("focus", focus); document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [refresh]);
  async function enableNotifications() {
    if (!("Notification" in window)) return;
    try { setPermission(await Notification.requestPermission()); } catch { setError("فعال‌سازی اعلان مرورگر ممکن نیست."); }
  }
  async function openNotice(item: Notice) {
    if (!item.read) {
      try {
        const response = await fetch("/api/itsm/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, kind: item.kind }) });
        if (!response.ok) throw new Error();
      } catch { setError("ثبت وضعیت اعلان ممکن نشد."); return; }
    }
    setOpen(false); void refresh();
    if (item.destination === "queue") onOpenQueue();
    else if (item.destination === "reports") window.location.assign("/tickets/reports");
    else if (item.ticketId) onOpenTicket(item.ticketId);
  }
  return <div className="itsm-notifications" ref={container}>
    <button type="button" className="itsm-bell" aria-label={`اعلان‌ها، ${feed.unreadCount.toLocaleString("fa-IR")} خوانده‌نشده`} aria-expanded={open} onClick={() => setOpen(!open)}><PortalIcon name="bell" size={22}/>{feed.unreadCount > 0 && <span>{feed.unreadCount > 99 ? "+۹۹" : feed.unreadCount.toLocaleString("fa-IR")}</span>}</button>
    {open && <div className="itsm-notifications-panel"><div className="itsm-notifications-heading"><strong>اعلان‌ها</strong><small>{feed.unreadCount.toLocaleString("fa-IR")} خوانده‌نشده</small></div>
      {permission === "default" && <button type="button" className="itsm-notification-enable" onClick={() => void enableNotifications()}>فعال‌سازی اعلان مرورگر</button>}
      {permission === "denied" && <p className="itsm-notification-help">اعلان مرورگر مسدود است؛ از تنظیمات مرورگر اجازه دهید.</p>}
      {permission === "unsupported" && <p className="itsm-notification-help">اعلان مرورگر در این محیط پشتیبانی نمی‌شود.</p>}
      {error && <p className="itsm-notification-help" role="status">{error}</p>}
      <div className="itsm-notifications-list">{feed.items.length ? feed.items.map((item) => <button type="button" key={`${item.kind}:${item.id}`} className={`itsm-notification-item${item.read ? "" : " unread"}`} onClick={() => void openNotice(item)}><strong>{item.title}</strong><span>{item.detail}</span><small>{new Date(item.createdAt).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })}</small></button>) : <p className="itsm-notification-help">اعلانی برای نمایش وجود ندارد.</p>}</div>
    </div>}
  </div>;
}
