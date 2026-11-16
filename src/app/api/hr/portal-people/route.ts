import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireHr } from "@/lib/guard";
import { candidates, getCfg, setCfg, noteOf, isShown, DEFAULTS, MAX_DAYS, effectiveWindow, type Kind } from "@/lib/portalPeople";

export const dynamic = "force-dynamic";
const kindOf = (s: string | null): Kind | null => (s === "birthday" || s === "hire" ? s : null);

export async function GET(req: Request) {
  const g = await requireHr(); if (g.err) return g.err;
  const kind = kindOf(new URL(req.url).searchParams.get("kind"));
  if (!kind) return NextResponse.json({ error: "نوع نامعتبر" }, { status: 400 });
  const cfg = await getCfg(kind);
  const q = Number(new URL(req.url).searchParams.get("days"));
  const period = new URL(req.url).searchParams.get("period");
  const win = kind === "hire" && period === "month" ? effectiveWindow(kind, { ...cfg, hirePeriod: "month" }) : q >= 1 ? effectiveWindow(kind, { ...cfg, hirePeriod: "days", days: Math.min(MAX_DAYS[kind], Math.floor(q)) }) : effectiveWindow(kind, cfg);
  const [raw, locations] = await Promise.all([candidates(kind, win), db.location.findMany({ where: { active: true }, orderBy: { id: "asc" } })]);
  const photos = raw.length ? await db.setting.findMany({ where: { key: { in: raw.map((r) => `portal.person.photo.${r.id}`) } }, select: { key: true, value: true } }) : [];
  const photoByKey = new Map(photos.map((p) => [p.key, p.value]));
  const rows = raw.map((r) => ({ ...r, note: noteOf(kind, cfg, r), photo: photoByKey.get(`portal.person.photo.${r.id}`) || null }));
  return NextResponse.json({ rows, cfg, max: MAX_DAYS[kind], defaults: DEFAULTS[kind], locations: locations.map((l) => ({ id: l.id, name: l.name })) });
}

export async function PUT(req: Request) {
  const g = await requireHr(); if (g.err) return g.err;
  const b = await req.json().catch(() => ({}));
  const kind = kindOf(b.kind);
  if (!kind) return NextResponse.json({ error: "نوع نامعتبر" }, { status: 400 });
  const nums = (a: unknown) => (Array.isArray(a) ? a.map(Number).filter((n) => Number.isInteger(n)) : []);
  const d = DEFAULTS[kind];
  const days = Math.min(MAX_DAYS[kind], Math.max(1, Math.floor(Number(b.days)) || d.days));
  const str = (v: unknown, def: string) => (typeof v === "string" ? v.trim().slice(0, 200) : def);
  await setCfg(kind, {
    hirePeriod: kind === "hire" && b.hirePeriod === "month" ? "month" : "days", locs: nums(b.locs), hidden: nums(b.hidden), approved: nums(b.approved), mode: b.mode === "approved" ? "approved" : "all",
    days, text: str(b.text, d.text) || d.text, todayText: str(b.todayText, d.todayText),
  });
  return NextResponse.json({ ok: true });
}
