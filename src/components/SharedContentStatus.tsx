"use client";
import { readLegacy } from "@/services/sharedPortalStore";
import { useEffect, useState } from "react";

type Props<T> = {
  label: string; legacyKey?: string; status: string; exists: boolean;
  save: (value: T) => void; retry: () => void; discardAndReload: () => void;
  select?: (value: any) => T | null;
};

export function SharedContentStatus<T>({ label, legacyKey, status, exists, save, retry, discardAndReload, select }: Props<T>) {
  const [hasLegacy, setHasLegacy] = useState(false);
  useEffect(() => {
    if (!legacyKey) { setHasLegacy(false); return; }
    const raw = readLegacy<any>(legacyKey);
    setHasLegacy(raw != null && (legacyKey !== "portal.pagecfg.v1" || !!raw.home));
  }, [legacyKey]);
  const importLegacy = () => {
    if (!legacyKey) return;
    const raw = readLegacy<any>(legacyKey);
    const value = select ? select(raw) : raw as T | null;
    if (value === null || value === undefined) { alert("داده‌ای برای انتقال در این مرورگر پیدا نشد."); return; }
    if (confirm(`اطلاعات قدیمی «${label}» از این مرورگر به سرور منتقل شود؟ داده‌های مرورگر حذف نمی‌شوند.`)) save(value);
  };
  return <div role="status" className={`shared-status is-${status}`}>
    <span>{label}: {status === "loading" ? "در حال دریافت" : status === "saving" ? "در حال ذخیره" : status === "error" ? "خطا در دریافت یا ذخیره" : status === "conflict" ? "تغییر هم‌زمان؛ ذخیره انجام نشد" : exists ? "ذخیره شده در سرور" : "آماده؛ استفاده از تنظیمات پیش‌فرض"}</span>{" "}
    {status === "ready" && !exists && hasLegacy && <button type="button" onClick={importLegacy}>انتقال اطلاعات قدیمی این مرورگر</button>}
    {status === "error" && <button type="button" onClick={retry}>تلاش دوباره</button>}
    {(status === "error" || status === "conflict") && <button type="button" onClick={discardAndReload}>دریافت نسخه سرور و کنار گذاشتن تغییر ذخیره‌نشده</button>}
  </div>;
}
