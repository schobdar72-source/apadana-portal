/**
 * تعریف نقش‌ها (یک جا). نقش می‌گوید «چه کاری»؛ قلمرو («روی چه کسانی») از چارت سازمانی محاسبه می‌شود.
 * نقش روی خود کارمند ذخیره می‌شود (Employee.role)؛ پس اگر کسی معاون شد فقط نقش او عوض می‌شود.
 */
export type Scope = "self" | "unit" | "subtree" | "all";

export const ROLES = {
  employee:   { label: "کارمند",            scope: "self" as Scope,    can: ["leave.request", "profile.view"] },
  unit_head:  { label: "مسئول واحد",         scope: "subtree" as Scope, can: ["leave.request", "leave.approve", "team.view", "chart.view"] },
  deputy:     { label: "معاون",              scope: "subtree" as Scope, can: ["leave.request", "leave.approve", "team.view", "chart.view"] },
  ceo:        { label: "مدیرعامل",           scope: "all" as Scope,     can: ["leave.request", "leave.approve", "team.view", "chart.view", "report.view"] },
  hr_admin:   { label: "مدیر منابع انسانی",   scope: "all" as Scope,     can: ["employee.read", "employee.manage", "org.manage", "role.assign", "team.view", "chart.view", "leave.view", "leave.approve"] },
  cafe_staff: { label: "کاربر کافی‌شاپ",      scope: "self" as Scope,    can: ["leave.request", "profile.view", "cafe.order"] },
  cafe_manager: { label: "مدیر کافی‌شاپ",     scope: "self" as Scope,    can: ["leave.request", "profile.view", "cafe.order", "cafe.manage"] },
  finance:    { label: "مالی",               scope: "self" as Scope,    can: ["leave.request", "profile.view", "finance.view"] },
  pr:         { label: "روابط عمومی",         scope: "self" as Scope,    can: ["leave.request", "profile.view", "lobby.manage"] },
  admin:      { label: "مدیر سیستم",         scope: "all" as Scope,     can: ["*"] },
} as const;

export type RoleKey = keyof typeof ROLES;
export const roleLabel = (k: string) => (ROLES as Record<string, { label: string }>)[k]?.label ?? k;
export const can = (role: string, perm: string) => {
  const r = (ROLES as Record<string, { can: readonly string[] }>)[role];
  return !!r && (r.can.includes("*") || r.can.includes(perm));
};
export const isRole = (k: unknown): k is RoleKey => typeof k === "string" && Object.prototype.hasOwnProperty.call(ROLES, k);

/** زنجیره‌ی تأیید به ازای نوع درخواست: direct = فقط مدیر مستقیم، chain = تا n سطح بالاتر. */
export const APPROVAL: Record<string, { mode: "direct" | "chain"; levels: number }> = {
  leave_hourly: { mode: "direct", levels: 1 },
  leave_daily:  { mode: "chain",  levels: 2 },
  leave_long:   { mode: "chain",  levels: 3 },
};
