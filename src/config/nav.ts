import type { NavIconName } from "@/components/layout/NavIcon";

// منوی مشترک همه‌ی صفحه‌های داخل AppShell. صفحه‌ی جدید فقط اینجا اضافه می‌شود.
// TODO: پس از RBAC، گروه‌ها بر اساس نقش کاربر فیلتر شوند (مثلاً سفارشی‌سازی فقط برای ادمین).
export type NavItem = { href: string; label: string };
export type NavGroup = { id: string; label: string; icon: NavIconName; items: NavItem[] };

export const CUSTOMIZE_BASE = "/admin/customize";

export const navGroups: NavGroup[] = [
  { id: "announcements", label: "روابط عمومی", icon: "mail", items: [{ href: "/announcements", label: "اطلاعیه‌ها" }, { href: "/announcements/manage", label: "مدیریت اطلاعیه‌ها" }] },
  {
    id: "hr", label: "منابع انسانی", icon: "users",
    items: [{ href: "/hr/birthdays", label: "تولد همکاران" }, { href: "/hr/hires", label: "استخدام‌های جدید" }, { href: "/hr/employees", label: "پرونده‌ی کارمندان" }, { href: "/hr/org", label: "ساختار سازمانی" }, { href: "/hr/org/chart", label: "چارت سازمانی" }, { href: "/hr/attendance", label: "حضور و غیاب" }],
  },
  { id: "cafe", label: "کافی‌شاپ و تغذیه", icon: "cafe", items: [{ href: "/cafe", label: "بسته و منوی من" }, { href: "/cafe/staff", label: "ثبت سفارش (کاربر کافی‌شاپ)" }, { href: "/cafe/manager", label: "مدیریت کافی‌شاپ" }, { href: "/cafe/reports", label: "گزارش‌ها" }] },
  { id: "finance", label: "مالی", icon: "wallet", items: [{ href: "/finance/cafe-reports", label: "گزارش‌های کافی‌شاپ" }] },
  {
    id: "apps", label: "سامانه‌ها", icon: "apps",
    items: [{ href: "/phonebook", label: "دفترچه تلفن" }, { href: "/phonebook/manage", label: "مدیریت دفترچه تلفن" }, { href: "/documents", label: "مستندات و فرم‌ها" }, { href: "/documents/manage", label: "مدیریت مستندات" }, { href: "/tickets", label: "تیکتینگ" }, { href: "/automation", label: "اتوماسیون اداری" }, { href: "/erp", label: "ERP" }],
  },
  {
    id: "lobby", label: "تلویزیون لابی", icon: "tv",
    items: [{ href: "/lobby/admin", label: "مدیریت لابی" }, { href: "/lobby", label: "نمای تلویزیون" }],
  },
  {
    id: "customize", label: "سفارشی‌سازی", icon: "brush",
    items: [{ href: CUSTOMIZE_BASE, label: "همه‌ی صفحه‌ها" }, { href: `${CUSTOMIZE_BASE}/home`, label: "صفحه‌ی اصلی" }],
  },
  {
    id: "ds", label: "سیستم طراحی", icon: "design",
    items: [{ href: "/design-system", label: "نمایش کامپوننت‌ها" }, { href: "/design-system#tokens", label: "توکن‌ها" }],
  },
];

/** لینکی از منو که با آدرس فعلی بیشترین تطابق را دارد (دقیق یا پیشوند مسیر). */
export function matchNav(groups: NavGroup[], activeHref: string): { groupId: string | null; href: string | null } {
  let best: { groupId: string | null; href: string | null; len: number } = { groupId: null, href: null, len: -1 };
  for (const g of groups) {
    for (const i of g.items) {
      if (i.href === "#" || i.href.includes("#")) { if (i.href === activeHref) return { groupId: g.id, href: i.href }; continue; }
      const hit = activeHref === i.href || activeHref.startsWith(i.href + "/");
      if (hit && i.href.length > best.len) best = { groupId: g.id, href: i.href, len: i.href.length };
    }
  }
  return { groupId: best.groupId, href: best.href };
}
