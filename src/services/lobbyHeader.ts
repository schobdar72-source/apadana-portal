"use client";
import { useSharedPortalStore } from "@/services/sharedPortalStore";
import type { CSSProperties } from "react";

export const defaultLobbyHeader = { image: "/assets/lobby/mining-panorama-v2.jpg" };
export function lobbyHeaderStyle(image: string): CSSProperties {
  const shade = image === defaultLobbyHeader.image
    ? "linear-gradient(to left, rgba(24,31,32,.9), rgba(24,31,32,.72) 25%, rgba(24,31,32,.12) 60%, transparent 78%)"
    : "linear-gradient(to left, rgba(28,30,32,.92), rgba(28,30,32,.35) 48%, transparent 75%)";
  return { backgroundImage: `${shade}, url("${image}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundColor: "#263234" };
}
export function useLobbyHeader() {
  return useSharedPortalStore("lobby-header", defaultLobbyHeader);
}

/** Limit both dimensions and output size before storing a header in the database. */
export async function prepareLobbyHeader(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("فرمت تصویر باید JPG، PNG یا WebP باشد.");
  if (file.size > 15 * 1024 * 1024) throw new Error("حجم فایل انتخابی باید کمتر از ۱۵ مگابایت باشد.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("خواندن تصویر ممکن نشد.")); image.src = url; });
    const scale = Math.min(1, 1920 / image.width, 1080 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("پردازش تصویر ممکن نشد.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.82);
    if (result.length > 1_900_000) throw new Error("تصویر پس از فشرده‌سازی هنوز بزرگ است؛ لطفاً تصویر سبک‌تری انتخاب کنید.");
    return result;
  } finally { URL.revokeObjectURL(url); }
}
