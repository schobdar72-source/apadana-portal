import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";
import { validExternalNews } from "@/config/pages";
import { validHomeSlides } from "@/config/homeSlides";

export const dynamic = "force-dynamic";
const names = ["home", "tiles", "cards", "calendar"] as const;
type Name = typeof names[number];
const keyOf = (name: Name) => `shared.portal.${name}.v1`;
const revision = (value: string) => createHash("sha256").update(value).digest("hex");
const isObj = (x: any) => x && typeof x === "object" && !Array.isArray(x);
const optText = (x: unknown) => x === undefined || typeof x === "string";

function valid(name: Name, v: any): boolean {
  if (JSON.stringify(v)?.length > 2_000_000) return false;
  if (name === "home") return isObj(v) && typeof v.enabled === "boolean" && typeof v.showWidgets === "boolean" && typeof v.title === "string" && typeof v.accent === "string" && (v.externalNews === undefined || validExternalNews(v.externalNews)) && (v.slides === undefined || validHomeSlides(v.slides));
  if (name === "calendar") return isObj(v) && typeof v.sourceUrl === "string" && Array.isArray(v.events) && v.events.every((e: any) => isObj(e) && typeof e.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.title === "string" && typeof e.holiday === "boolean");
  if (!Array.isArray(v)) return false;
  if (name === "tiles") return v.every((t: any) => isObj(t) && [t.id, t.title, t.desc, t.href, t.icon].every((x: unknown) => typeof x === "string") && typeof t.on === "boolean" && typeof t.locked === "boolean" && optText(t.image) && optText(t.titleColor));
  return v.every((c: any) => isObj(c) && ["calendar", "birthday", "hire", "meal"].includes(c.id) && typeof c.title === "string" && optText(c.text) && optText(c.image) && optText(c.titleColor) && (c.on === undefined || typeof c.on === "boolean")) && new Set(v.map((c: any) => c.id)).size === v.length;
}

export async function POST(req: Request) {
  const auth = await requirePerm("system.config"); if (auth.err) return auth.err;
  try {
    const body = await req.json();
    if (body?.format !== "apadana-home-settings" || body?.version !== 1 || !isObj(body.sections) || !isObj(body.revisions) || !names.every((name) => valid(name, body.sections[name]) && (body.revisions[name] === null || typeof body.revisions[name] === "string"))) return NextResponse.json({ error: "invalid_backup" }, { status: 400 });
    await db.$transaction(async (tx) => {
      for (const name of names) {
        const key = keyOf(name);
        const current = await tx.setting.findUnique({ where: { key } });
        if ((current ? revision(current.value) : null) !== body.revisions[name]) throw new Error("conflict");
        const value = JSON.stringify(body.sections[name]);
        if (current) {
          const result = await tx.setting.updateMany({ where: { key, value: current.value }, data: { value } });
          if (!result.count) throw new Error("conflict");
        } else await tx.setting.create({ data: { key, value } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "conflict" || e?.code === "P2002" || e?.code === "P2034") return NextResponse.json({ error: "conflict" }, { status: 409 });
    return NextResponse.json({ error: "restore_failed" }, { status: 500 });
  }
}
