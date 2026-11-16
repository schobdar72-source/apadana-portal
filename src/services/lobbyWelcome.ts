"use client";
import { useSharedPortalStore } from "@/services/sharedPortalStore";

export const defaultLobbyWelcome = { title: "آپادانا کاوش", highlight: "ایرانیان", subtitle: "شرکت مهندسی و معدنی", greeting: "خوش آمدید", titleColor: "#ffffff", highlightColor: "#ffbd16", subtitleColor: "#ffffff", greetingColor: "#ffbd16" };
export type LobbyWelcome = typeof defaultLobbyWelcome;
export const useLobbyWelcome = () => useSharedPortalStore("lobby-welcome", defaultLobbyWelcome);
