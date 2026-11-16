"use client";

import { useEffect, useState } from "react";

type Expert = { id: number; firstName: string; lastName: string; code: string };

export function ItsmAssignTicket({ ticketId, onAssigned }: { ticketId: number; onAssigned: () => void }) {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setEmployeeId("");
    void fetch(`/api/itsm/tickets/${ticketId}/assign`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "فهرست کارشناسان دریافت نشد.");
      if (live) setExperts(data);
    }).catch((reason) => { if (live) setError(reason instanceof Error ? reason.message : "فهرست کارشناسان دریافت نشد."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [ticketId]);
  async function assign() {
    if (!employeeId || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/itsm/tickets/${ticketId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: Number(employeeId) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "انتصاب انجام نشد.");
      onAssigned();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "انتصاب انجام نشد."); }
    finally { setBusy(false); }
  }
  return <div className="itsm-assignment"><label>انتصاب به کارشناس<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={loading || busy}><option value="">{loading ? "در حال دریافت کارشناسان..." : "کارشناس واحد را انتخاب کنید"}</option>{experts.map((expert) => <option key={expert.id} value={expert.id}>{expert.firstName} {expert.lastName} · {expert.code}</option>)}</select></label><button className="itsm-primary" type="button" disabled={!employeeId || busy} onClick={() => void assign()}>{busy ? "در حال انتصاب..." : "انتصاب تیکت"}</button>{!loading && !experts.length && !error && <p>کارشناس فعالی در این واحد و محل خدمت تعیین نشده است.</p>}{error && <p role="alert">{error}</p>}</div>;
}
