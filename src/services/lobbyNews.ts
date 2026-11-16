"use client";
import { useSharedPortalStore } from "@/services/sharedPortalStore";

// اطلاعیه‌های روابط عمومی. تا وجود بک‌اند در localStorage ذخیره می‌شود (نمونه).
export type Announcement = {
  id: string; title: string;
  summary: string;      // حداکثر ۱۵۰ نویسه
  body?: string;        // ادامه مطلب (اختیاری)
  poster?: string;      // تصویر پوستر (اختیاری)
  portal: boolean; lobby: boolean;
  date: string;         // YYYY-MM-DD میلادی
  from?: string;        // نمایش از تاریخ (YYYY-MM-DD)، خالی = از همین حالا
  to?: string;          // نمایش تا تاریخ، خالی = بدون پایان
  pinned?: boolean;     // سنجاق: همیشه اول لیست
  createdAt?: string;
  locationIds?: number[];
  disabled?: boolean;
};

// آیا اطلاعیه امروز باید نمایش داده شود؟
export const isShown = (a: Announcement, today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date())) =>
  (!a.from || a.from <= today) && (!a.to || today <= a.to);

// سنجاق‌شده‌ها اول بیایند؛ بقیه ترتیب اصلی را حفظ کنند
export const sortAnnouncements = (l: Announcement[]) =>
  [...l].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
export const SUMMARY_MAX = 150;
const emptyNews: Announcement[] = [];
export function useAnnouncements(audience?: "portal" | "lobby" | "archive") {
  const store = useSharedPortalStore<Announcement[]>("news", emptyNews, audience);
  return { ...store, items: store.value };
}
