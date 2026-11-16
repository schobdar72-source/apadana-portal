"use client";
import type { ReactNode } from "react";
import { canSee } from "@/config/access";
import { useMe } from "@/services/useMe";
import { Note } from "@/components/ui";

/** محتوای صفحه را فقط به نقش‌های مجاز نشان می‌دهد (config/access.ts). */
export function AccessGate({ href, children }: { href: string; children: ReactNode }) {
  const me = useMe();
  if (me === undefined) return null;
  if (!me || !canSee(me.role, href)) return <Note>شما به این صفحه دسترسی ندارید. اگر فکر می‌کنید باید دسترسی داشته باشید، با مدیر منابع انسانی تماس بگیرید.</Note>;
  return <>{children}</>;
}
