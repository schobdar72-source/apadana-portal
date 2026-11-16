import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";
import { currentUser } from "@/lib/auth";
import { can } from "@/config/roles";
import { createHash } from "crypto";
import { validExternalNews } from "@/config/pages";
import { validLoginSettings } from "@/config/login";
import { validHomeSlides } from "@/config/homeSlides";
import { canReadAnnouncement } from "@/lib/announcementVisibility";

export const dynamic = "force-dynamic";
const keys: Record<string, { permission: string; array: boolean }> = {
  news: { permission: "lobby.manage", array: true },
  tiles: { permission: "system.config", array: true },
  cards: { permission: "system.config", array: true },
  calendar: { permission: "system.config", array: false },
  home: { permission: "system.config", array: false },
  login: { permission: "system.config", array: false },
  "lobby-cards": { permission: "lobby.manage", array: true },
  "lobby-posters": { permission: "lobby.manage", array: true },
  "lobby-display": { permission: "lobby.manage", array: false },
  "lobby-header": { permission: "lobby.manage", array: false },
  "lobby-welcome": { permission: "lobby.manage", array: false },
};
const settingKey = (key: string) => `shared.portal.${key}.v1`;
const revision = (value: string) => createHash("sha256").update(value).digest("hex");

export async function GET(req: Request, { params }: { params: { key: string } }) {
  if (!keys[params.key]) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const record = await db.setting.findUnique({ where: { key: settingKey(params.key) } });
    let value = record ? JSON.parse(record.value) : null;
    if (params.key === "news") {
      const user = await currentUser();
      const audience = new URL(req.url).searchParams.get("audience");
      if (audience === "archive" && !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      if (value && (audience || !user || !can(user.role, "lobby.manage"))) {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
        let locationId = user?.locationId ?? null;
        if (audience === "lobby" || !user) {
          const display = await db.setting.findUnique({ where: { key: settingKey("lobby-display") } });
          try { locationId = display ? JSON.parse(display.value).locationId ?? null : null; } catch { locationId = null; }
        }
        const scope = audience === "lobby" || !user ? "lobby" : audience === "portal" || audience === "archive" ? audience : "current";
        value = value.filter((item: Parameters<typeof canReadAnnouncement>[0]) => canReadAnnouncement(item, scope, today, locationId));
      }
    }
    return NextResponse.json({ value, version: record ? revision(record.value) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  const spec = keys[params.key];
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  const auth = await requirePerm(spec.permission); if (auth.err) return auth.err;
  try {
    const body = await req.json();
    const value = body?.value;
    if (!value || typeof value !== "object" || Array.isArray(value) !== spec.array || (body.version !== null && typeof body.version !== "string")) return NextResponse.json({ error: "invalid data" }, { status: 400 });
    if (params.key === "calendar" && (typeof value.sourceUrl !== "string" || !Array.isArray(value.events))) return NextResponse.json({ error: "invalid calendar" }, { status: 400 });
    if (params.key === "calendar" && !value.events.every((e: any) => e && typeof e.id === "string" && typeof e.date === "string" && typeof e.title === "string" && typeof e.holiday === "boolean")) return NextResponse.json({ error: "invalid events" }, { status: 400 });
    if (params.key === "tiles" && !value.every((t: any) => t && [t.id, t.title, t.desc, t.href, t.icon].every((x: unknown) => typeof x === "string") && typeof t.on === "boolean" && typeof t.locked === "boolean")) return NextResponse.json({ error: "invalid tiles" }, { status: 400 });
    if (params.key === "cards" && !value.every((c: any) => c && ["calendar", "birthday", "hire", "meal"].includes(c.id) && typeof c.title === "string" && (c.on === undefined || typeof c.on === "boolean"))) return NextResponse.json({ error: "invalid cards" }, { status: 400 });
    if (params.key === "lobby-cards" && (value.length > 30 || !value.every((c: any) => c && typeof c.id === "string" && typeof c.title === "string" && c.title.length <= 120 && ["announcements","birthdays","news","currency","meal","custom"].includes(c.kind) && typeof c.on === "boolean" && (c.text === undefined || typeof c.text === "string" && c.text.length <= 2000)))) return NextResponse.json({ error: "invalid lobby cards" }, { status: 400 });
    if (params.key === "lobby-display" && !(value.locationId === null || Number.isSafeInteger(value.locationId) && value.locationId > 0)) return NextResponse.json({ error: "invalid location" }, { status: 400 });
    if (params.key === "lobby-header" && (typeof value.image !== "string" || (value.image !== "" && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.image)))) return NextResponse.json({ error: "invalid lobby header" }, { status: 400 });
    if (params.key === "lobby-welcome" && (!["title", "highlight", "subtitle", "greeting"].every(k => typeof value[k] === "string" && value[k].length <= 80) || !["titleColor", "highlightColor", "subtitleColor", "greetingColor"].every(k => typeof value[k] === "string" && /^#[0-9a-fA-F]{6}$/.test(value[k])))) return NextResponse.json({ error: "invalid lobby welcome" }, { status: 400 });
    if (params.key === "lobby-posters" && (value.length > 20 || !value.every((p: any) => p && typeof p.id === "string" && typeof p.title === "string" && typeof p.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p.image) && p.image.length <= 2800000 && typeof p.on === "boolean" && Number.isFinite(p.seconds) && p.seconds >= 3 && p.seconds <= 3600 && (!p.start || /^\d{4}-\d{2}-\d{2}$/.test(p.start)) && (!p.end || /^\d{4}-\d{2}-\d{2}$/.test(p.end)) && (!p.start || !p.end || p.start <= p.end)))) return NextResponse.json({ error: "invalid lobby posters" }, { status: 400 });
    if (params.key === "home" && (typeof value.enabled !== "boolean" || typeof value.showWidgets !== "boolean" || typeof value.title !== "string" || typeof value.accent !== "string")) return NextResponse.json({ error: "invalid home configuration" }, { status: 400 });
    if (params.key === "home" && value.externalNews !== undefined && !validExternalNews(value.externalNews)) return NextResponse.json({ error: "invalid external news configuration" }, { status: 400 });
    if (params.key === "home" && value.slides !== undefined && !validHomeSlides(value.slides)) return NextResponse.json({ error: "invalid slides" }, { status: 400 });
    if (params.key === "login" && !validLoginSettings(value)) return NextResponse.json({ error: "invalid login configuration" }, { status: 400 });
    if (params.key === "news" && !value.every((n: any) => n && [n.id, n.title, n.summary, n.date].every((x: unknown) => typeof x === "string") && typeof n.portal === "boolean" && typeof n.lobby === "boolean" && (n.disabled === undefined || typeof n.disabled === "boolean") && [n.body, n.poster, n.from, n.to, n.createdAt].every((x: unknown) => x === undefined || typeof x === "string") && (n.locationIds === undefined || Array.isArray(n.locationIds) && n.locationIds.every((id: unknown) => Number.isSafeInteger(id) && Number(id) > 0)))) return NextResponse.json({ error: "invalid announcements" }, { status: 400 });
    const serialized = JSON.stringify(value);
    if (serialized.length > 2_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
    const key = settingKey(params.key);
    if (body.version === null) {
      try { await db.setting.create({ data: { key, value: serialized } }); }
      catch (e: any) { if (e?.code === "P2002") return NextResponse.json({ error: "conflict" }, { status: 409 }); throw e; }
    } else {
      const current = await db.setting.findUnique({ where: { key } });
      if (!current || revision(current.value) !== body.version) return NextResponse.json({ error: "conflict" }, { status: 409 });
      const updated = await db.setting.updateMany({ where: { key, value: current.value }, data: { value: serialized } });
      if (!updated.count) return NextResponse.json({ error: "conflict" }, { status: 409 });
    }
    return NextResponse.json({ version: revision(serialized) });
  } catch { return NextResponse.json({ error: "save failed" }, { status: 500 }); }
}
