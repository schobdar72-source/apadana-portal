"use client";
import Link from "next/link";
import "@/styles/customize.css";
import { pageDefs } from "@/config/pages";
import { usePageCfg, writePageCfg, resolveCfg } from "@/services/pageCfg";
import { AppShell } from "@/components/layout/AppShell";

// فهرست صفحه‌ها؛ هر کارت وضعیت، کلید فعال/غیرفعال و ورود به تنظیمات همان صفحه را دارد.
// صفحه‌ی اصلی (home) مدیریت کاشی‌ها و کارت‌هاست و تنظیمات جداگانه ندارد.
function Card({ id, label, href, locked }: { id: (typeof pageDefs)[number]["id"]; label: string; href: string; locked: boolean }) {
  const { cfg } = usePageCfg(id);
  const custom = JSON.stringify(cfg) !== JSON.stringify(resolveCfg(id, {}));
  return (
    <div className="cz-card">
      <div className="cz-card-head">
        <b>{label}</b>
        <span className={`cz-badge ${cfg.enabled ? "on" : "off"}`}>{cfg.enabled ? "فعال" : "غیرفعال"}</span>
      </div>
      <small>{href}</small>
      <div className="cz-card-foot">
        <label>
          <input type="checkbox" checked={cfg.enabled} disabled={locked}
            onChange={(e) => writePageCfg(id, { enabled: e.target.checked })} />
          نمایش صفحه{locked && " (همیشه فعال)"}
        </label>
        {custom && <span className="cz-tag">سفارشی‌شده</span>}
      </div>
      <Link href={`/admin/customize/${id}`} className="cz-go">ویرایش</Link>
    </div>
  );
}

export default function CustomizeIndex() {
  return (
    <AppShell title="سفارشی‌سازی" activeHref="/admin/customize">
      <div className="cz-wrap">
        <p className="cz-lead">تنظیمات هر صفحه را اینجا تغییر دهید. تغییرات فوراً ذخیره می‌شوند.</p>
        <div className="cz-grid">
          <Link href="/admin/customize/home" className="cz-card cz-card-link">
            <div className="cz-card-head"><b>صفحه‌ی اصلی</b><span className="cz-badge on">فعال</span></div>
            <small>کاشی‌ها، کارت‌ها و تقویم</small>
            <span className="cz-go">مدیریت</span>
          </Link>
          {pageDefs.filter((p) => p.id !== "home").map((p) => (
            <Card key={p.id} id={p.id} label={p.label} href={p.href} locked={p.locked} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
