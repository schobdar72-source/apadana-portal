"use client";

import { useState } from "react";

export function ItsmReopenTicket({ ticketId, onDone }: { ticketId: number; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reopen(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !reason.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/itsm/tickets/${ticketId}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "in_progress", reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "بازکردن تیکت ممکن نشد.");
      setOpen(false); setReason(""); await onDone();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "بازکردن تیکت ممکن نشد."); }
    finally { setBusy(false); }
  }
  return <div className="itsm-pause-ticket"><button type="button" className="itsm-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>مشکل برطرف نشده است</button>{open && <form className="itsm-repair-form" onSubmit={reopen}><label>توضیح مشکل برای بررسی دوباره<textarea required maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)}/></label>{error && <p role="alert">{error}</p>}<button className="itsm-primary" disabled={busy || !reason.trim()}>{busy ? "در حال ثبت..." : "ارسال و بازکردن دوباره تیکت"}</button></form>}</div>;
}
