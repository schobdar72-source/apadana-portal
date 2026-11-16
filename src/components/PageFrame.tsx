"use client";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { NavGroup } from "@/config/nav";
import { pageDef, type PageId } from "@/config/pages";
import { usePageCfg } from "@/services/pageCfg";
import { AppShell } from "@/components/layout/AppShell";

/** صفحه‌ی غیرفعال‌شده توسط کاربر (از سفارشی‌سازی) */
export function PageGate({ label }: { label: string }) {
  return (
    <main className="hp-soon">
      <div className="hp-card">
        <h1>{label}</h1>
        <p>این صفحه موقتاً غیرفعال شده است.</p>
        <Link className="hp-login" href="/">بازگشت به صفحه‌ی اصلی</Link>
      </div>
    </main>
  );
}

/**
 * قاب صفحه‌های داخلی: اعمال تنظیمات سفارشی‌سازی (فعال/غیرفعال، عنوان، رنگ، ساعت و آب‌وهوا) روی AppShell.
 * title پیش‌فرض است و اگر کاربر عنوان نمایشی بدهد جایگزین می‌شود.
 */
export function PageFrame({ id, title, activeHref, groups, children }: { id: PageId; title: string; activeHref: string; groups?: NavGroup[]; children: ReactNode }) {
  const { cfg } = usePageCfg(id);
  if (!cfg.enabled) return <PageGate label={pageDef(id).label} />;
  const style = cfg.accent ? ({ "--c-accent": cfg.accent } as CSSProperties) : undefined;
  return (
    <AppShell title={cfg.title || title} activeHref={activeHref} groups={groups} widgets={cfg.showWidgets} style={style}>
      {children}
    </AppShell>
  );
}
