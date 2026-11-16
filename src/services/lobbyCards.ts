"use client";
import { useSharedPortalStore } from "@/services/sharedPortalStore";

// تنظیمات کارت‌های لابی. تا وجود بک‌اند در localStorage مرورگر ذخیره می‌شود (نمونه).
export type CardKind = "announcements" | "birthdays" | "news" | "currency" | "meal" | "custom";
export type LobbyCard = { id: string; kind: CardKind; title: string; on: boolean; text?: string };

export const defaultCards: LobbyCard[] = [
  { id: "announcements", kind: "announcements", title: "اطلاعیه‌ها", on: true },
  { id: "birthdays", kind: "birthdays", title: "تولد همکاران", on: true },
  { id: "news", kind: "news", title: "خبرهای روز", on: true },
  { id: "currency", kind: "currency", title: "نرخ ارز و طلا", on: true },
  { id: "meal", kind: "meal", title: "غذای روز", on: true },
];

export function useLobbyCards() {
  const store = useSharedPortalStore<LobbyCard[]>("lobby-cards", defaultCards);
  return { ...store, cards: store.value };
}
