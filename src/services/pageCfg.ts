"use client";
import { useCallback, useEffect, useState } from "react";
import { pageDef, type PageCfg, type PageId } from "@/config/pages";

// کلید ذخیره: { [pageId]: Partial<PageCfg> } — فقط مقادیر تغییریافته
export const PAGECFG_KEY = "portal.pagecfg.v1";
const EVT = "portal:pagecfg";

type Overrides = Partial<Record<PageId, Partial<PageCfg>>>;

function readAll(): Overrides {
  try {
    const r = localStorage.getItem(PAGECFG_KEY);
    const o = r ? JSON.parse(r) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

/** ترکیب پیش‌فرض با تغییرات کاربر؛ اگر کلیدی حذف شده باشد پیش‌فرض برمی‌گردد */
export function resolveCfg(id: PageId, all: Overrides): PageCfg {
  const d = pageDef(id).defaults;
  const o = all[id] ?? {};
  const cfg: PageCfg = { ...d, ...o };
  if (pageDef(id).locked) cfg.enabled = true;
  return cfg;
}

/** ذخیره‌ی تغییرات یک صفحه؛ فقط پس از نوشتن موفق، state و رویداد همگام‌سازی به‌روز می‌شود */
export function writePageCfg(id: PageId, patch: Partial<PageCfg> | null): boolean {
  const all = readAll();
  if (patch === null) {
    delete all[id];
  } else {
    const d = pageDef(id).defaults;
    const next: Partial<PageCfg> = {};
    (Object.keys(patch) as (keyof PageCfg)[]).forEach((k) => {
      if (patch[k] !== d[k]) (next as Record<string, unknown>)[k] = patch[k];
    });
    if (Object.keys(next).length) all[id] = next; else delete all[id];
  }
  try {
    if (Object.keys(all).length) localStorage.setItem(PAGECFG_KEY, JSON.stringify(all));
    else localStorage.removeItem(PAGECFG_KEY);
  } catch {
    alert("ذخیره نشد؛ حجم داده‌ها از سقف مرورگر بیشتر است.");
    return false;
  }
  window.dispatchEvent(new Event(EVT));
  return true;
}

/** تنظیمات یک صفحه؛ با تغییر در همان سند (از طریق رویداد) یا سند دیگر (storage) به‌روز می‌شود */
export function usePageCfg(id: PageId) {
  const [all, setAll] = useState<Overrides>({});
  useEffect(() => {
    const sync = () => setAll(readAll());
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === PAGECFG_KEY || e.key === null) sync(); };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const cfg = resolveCfg(id, all);
  const save = useCallback((patch: Partial<PageCfg>) => { writePageCfg(id, patch); }, [id]);
  const reset = useCallback(() => { writePageCfg(id, null); }, [id]);
  return { cfg, save, reset, loaded: true };
}
