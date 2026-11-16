"use client";
import { useCallback, useEffect, useState } from "react";

export type FinRow = { code: string; name: string; grp: string; unit: string; pkg: number; used: number; left: number; excess: number };
export type FinScope = { unit: string; group: string; balance: string; search: string };
export type FinBreakdown = { employee: number; unlimited: number; guest: number; unmatched: number };
export type FinReport = {
  id: string; period: string; from: string; to: string; sender: string; ts: number;
  sales: number; count: number; rows: FinRow[]; scope?: FinScope; breakdown?: FinBreakdown;
};

export function useFinanceReports() {
  const [list, setList] = useState<FinReport[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => fetch("/api/cafe/finance", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then((d) => { if (!Array.isArray(d)) throw new Error(); setList(d); setError(""); setReady(true); }).catch(() => { setError("فهرست گزارش‌های مالی دریافت نشد."); setReady(true); }), []);
  useEffect(() => { load(); }, [load]);
  const save = async (next: FinReport[]) => {
    const res = await fetch("/api/cafe/finance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (res.ok) setList(next);
    return res.ok;
  };
  return { list, ready, error, save, reload: load };
}
