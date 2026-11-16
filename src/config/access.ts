import { can } from "./roles";

/**
 * مجوز لازم برای هر مسیر (طولانی‌ترین پیشوند برنده است). داشتن یکی از مجوزها کافی است.
 * مسیرهایی که اینجا نیستند برای همه‌ی کاربران واردشده باز هستند.
 * صفحه‌ی محدود جدید فقط اینجا اضافه می‌شود؛ منو و صفحه هر دو از همین فهرست پیروی می‌کنند.
 * داده‌ها جداگانه در API با requirePerm محافظت می‌شوند.
 */
export const PAGE_PERMS: [string, string[]][] = [
  ["/hr", []],
  ["/hr/employees", ["employee.read", "org.manage"]],
  ["/hr/org", ["org.manage"]],
  ["/hr/birthdays", ["org.manage"]],
  ["/hr/hires", ["org.manage"]],
  ["/hr/attendance", []],
  ["/cafe/staff", ["cafe.order"]],
  ["/cafe/manager", ["cafe.manage"]],
  ["/cafe/reports", ["cafe.manage"]],
  ["/finance", ["finance.view"]],
  ["/lobby/admin", ["lobby.manage"]],
  ["/announcements/manage", ["lobby.manage"]],
  ["/phonebook/manage", ["system.config"]],
  ["/documents/manage", ["system.config"]],
  ["/admin", ["system.config"]],
  ["/design-system", ["system.config"]],
];

export function permsFor(href: string): string[] {
  const path = href.split(/[?#]/)[0];
  let best: [string, string[]] | null = null;
  for (const e of PAGE_PERMS) if ((path === e[0] || path.startsWith(e[0] + "/")) && (!best || e[0].length > best[0].length)) best = e;
  return best ? best[1] : [];
}

export function canSee(role: string, href: string): boolean {
  const perms = permsFor(href);
  return perms.length === 0 || perms.some((p) => can(role, p));
}
