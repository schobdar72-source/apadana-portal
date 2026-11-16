"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type SharedKey = "news" | "tiles" | "cards" | "calendar" | "home" | "login" | "lobby-cards" | "lobby-posters" | "lobby-display" | "lobby-header" | "lobby-welcome";
type Status = "loading" | "ready" | "saving" | "error" | "conflict";

/** Each dataset is versioned on the server; rapid edits are saved in order. */
export function useSharedPortalStore<T>(key: SharedKey, fallback: T, audience?: "portal" | "lobby" | "archive") {
  const [value, setValue] = useState<T>(fallback);
  const [status, setStatus] = useState<Status>("loading");
  const [exists, setExists] = useState(false);
  const [dirty, setDirty] = useState(false);
  const version = useRef<string | null>(null);
  const ready = useRef(false);
  const pending = useRef<T | undefined>(undefined);
  const busy = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>();

  const refresh = useCallback(async () => {
    if (busy.current || pending.current !== undefined) return;
    try {
      const response = await fetch(`/api/portal/content/${key}${audience ? `?audience=${audience}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (busy.current || pending.current !== undefined) return;
      version.current = data.version; ready.current = true;
      if (mounted.current) { setValue(data.value ?? fallback); setExists(data.version !== null); setStatus("ready"); }
    } catch { if (mounted.current) setStatus("error"); }
  }, [key, fallback, audience]);

  const flush = useCallback(async () => {
    if (busy.current || pending.current === undefined || !ready.current) return;
    busy.current = true;
    while (pending.current !== undefined) {
      const next = pending.current; pending.current = undefined;
      try {
        const response = await fetch(`/api/portal/content/${key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: next, version: version.current }) });
        if (!response.ok) {
          pending.current = pending.current ?? next;
          if (mounted.current) setStatus(response.status === 409 ? "conflict" : "error");
          busy.current = false; return;
        }
        const result = await response.json(); version.current = result.version;
        if (mounted.current) setExists(true);
      } catch {
        pending.current = pending.current ?? next;
        if (mounted.current) setStatus("error");
        busy.current = false; return;
      }
    }
    busy.current = false;
    if (mounted.current) { setDirty(false); setStatus("ready"); }
  }, [key]);

  const save = useCallback((next: T) => {
    if (!ready.current) { setStatus("error"); return; }
    setValue(next); pending.current = next; setDirty(true); setStatus("saving");
    clearTimeout(timer.current); timer.current = setTimeout(flush, 400);
  }, [flush]);
  const retry = useCallback(() => {
    if (!ready.current || pending.current === undefined) { setStatus("loading"); void refresh(); }
    else { setStatus("saving"); void flush(); }
  }, [flush, refresh]);
  const discardAndReload = useCallback(() => { pending.current = undefined; setDirty(false); setStatus("loading"); void refresh(); }, [refresh]);
  const getRevision = useCallback(() => version.current, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const poll = setInterval(refresh, 30000);
    return () => { mounted.current = false; clearInterval(poll); };
  }, [refresh]);
  return { value, save, status, exists, dirty, getRevision, retry, discardAndReload };
}

/** The old browser data stays in place; only explicit user action imports it. */
export function readLegacy<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
