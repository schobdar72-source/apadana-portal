"use client";
import { useState } from "react";
import { itsmNotify } from "@/components/ItsmFeedback";

export function ItsmAssetMaintenance({ assetId, onChange }: { assetId: number; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("service");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch(`/api/itsm/assets/${assetId}/maintenance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, date, note }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      setNote(""); setDate(""); setOpen(false); itsmNotify("سابقه ثبت شد."); onChange();
    } catch (error) { itsmNotify(error instanceof Error ? error.message : "ثبت سابقه انجام نشد.", "err"); }
    finally { setBusy(false); }
  }
  return <div className="itsm-asset-repair"><button type="button" className="itsm-secondary" onClick={() => setOpen(!open)} aria-expanded={open}>ثبت سرویس و سابقه</button>{open && <form className="itsm-repair-form" onSubmit={submit}><label>نوع سابقه<select value={kind} onChange={event => setKind(event.target.value)}><option value="service">سرویس</option><option value="repair">تعمیر انجام‌شده</option><option value="replacement">تعویض قطعه یا تجهیز</option><option value="inspection">بازبینی وضعیت</option></select></label><label>تاریخ انجام<input required type="date" value={date} onChange={event => setDate(event.target.value)}/></label><label>شرح کار و وضعیت دستگاه<textarea required maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)}/></label><button className="itsm-primary" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت سابقه"}</button></form>}</div>;
}
