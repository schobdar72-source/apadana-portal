"use client";
import { useEffect, useState } from "react";

export type Me = { code: string; firstName: string; lastName: string; role: string };
export { roleLabel } from "@/config/roles";

let cached: Promise<Me | null> | null = null;
const loadMe = () => (cached ??= fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).catch(() => null));

/** undefined = در حال بارگذاری، null = وارد نشده */
export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadMe().then((m) => { if (live) setMe(m); });
    return () => { live = false; };
  }, []);
  return me;
}
