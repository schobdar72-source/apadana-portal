// رجیستری صفحه‌های قابل سفارشی‌سازی. صفحه‌ی جدید فقط به انتهای فهرست اضافه می‌شود.
// فقط مقادیری که کاربر تغییر داده در localStorage ذخیره می‌شود (کلید: portal.pagecfg.v1).

export type PageId = "home" | "login" | "lobby" | "hr" | "attendance" | "cafe" | "tickets" | "automation" | "erp";

export type ExternalNewsConfig = { enabled: boolean; source: "irna" | "mehr" | "darsotoon"; count: number; sourceExplicit?: boolean };
export const defaultExternalNews: ExternalNewsConfig = { enabled: true, source: "darsotoon", count: 20, sourceExplicit: true };
export function validExternalNews(value: unknown): value is ExternalNewsConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as ExternalNewsConfig;
  return typeof v.enabled === "boolean" && (v.source === "irna" || v.source === "mehr" || v.source === "darsotoon") && (v.sourceExplicit === undefined || typeof v.sourceExplicit === "boolean") && Number.isInteger(v.count) && v.count >= 3 && v.count <= 20;
}
export const externalNewsConfig = (value: unknown): ExternalNewsConfig => validExternalNews(value) ? { ...value, source: value.sourceExplicit ? value.source : "darsotoon", sourceExplicit: true, count: value.count <= 8 ? 20 : value.count } : defaultExternalNews;

export type PageCfg = {
  enabled: boolean;     // نمایش صفحه؛ صفحه‌ی اصلی و ورود همیشه فعال‌اند
  accent: string;       // رنگ تاکیدی (هگز)، خالی یعنی پیش‌فرض
  showWidgets: boolean; // ساعت و آب‌وهوا در هدر
  title: string;        // عنوان نمایشی؛ خالی یعنی پیش‌فرض صفحه
  externalNews?: ExternalNewsConfig; // optional for older home settings and backups
  slides?: import("./homeSlides").HomeSlide[];
};

export type PageDef = { id: PageId; label: string; href: string; locked: boolean; defaults: PageCfg };

const base: PageCfg = { enabled: true, accent: "", showWidgets: true, title: "" };

export const pageDefs: PageDef[] = [
  { id: "home", label: "صفحه‌ی اصلی", href: "/", locked: true, defaults: base },
  { id: "login", label: "ورود", href: "/login", locked: true, defaults: base },
  { id: "lobby", label: "تلویزیون لابی", href: "/lobby", locked: false, defaults: base },
  { id: "hr", label: "منابع انسانی", href: "/hr", locked: false, defaults: base },
  { id: "attendance", label: "حضور و غیاب", href: "/hr/attendance", locked: false, defaults: base },
  { id: "cafe", label: "کافی‌شاپ و تغذیه", href: "/cafe", locked: false, defaults: base },
  { id: "tickets", label: "تیکتینگ", href: "/tickets", locked: false, defaults: base },
  { id: "automation", label: "اتوماسیون اداری", href: "/automation", locked: false, defaults: base },
  { id: "erp", label: "ERP", href: "/erp", locked: false, defaults: base },
];

export const pageDef = (id: PageId) => pageDefs.find((p) => p.id === id)!;
