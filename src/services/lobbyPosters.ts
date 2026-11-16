"use client";
import { useSharedPortalStore } from "@/services/sharedPortalStore";

// پوسترهای اسلایدر لابی. تا وجود بک‌اند در localStorage ذخیره می‌شود (نمونه).
export type Poster = {
  id: string; title: string; image: string; on: boolean;
  seconds: number;      // مدت نمایش همین پوستر
  start?: string;       // YYYY-MM-DD میلادی (ذخیره)، نمایش شمسی در رابط
  end?: string;
  permanent?: boolean;  // همیشگی: تاریخ ندارد و همیشه در چرخش است
};
export const POSTER_SIZE = { w: 1920, h: 340 };
const emptyPosters: Poster[] = [];
export const isActive = (p: Poster, today = new Date().toISOString().slice(0, 10)) =>
  p.on && (p.permanent || ((!p.start || p.start <= today) && (!p.end || p.end >= today)));

export function useLobbyPosters() {
  const store = useSharedPortalStore<Poster[]>("lobby-posters", emptyPosters);
  return { ...store, posters: store.value };
}

// کوچک‌سازی تصویر به عرض ۱۹۲۰ برای ذخیره‌ی سبک
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, POSTER_SIZE.w / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
