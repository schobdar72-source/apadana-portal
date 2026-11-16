import { NextResponse } from "next/server";
import { candidates, getCfg, visible, noteOf, effectiveWindow } from "@/lib/portalPeople";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// عمومی (صفحه‌ی اصلی): فقط نام، واحد، عنوان شغلی و روز/ماه؛ بعد از فیلتر و مخفی‌سازی توسط منابع انسانی.
export async function GET() {
  const user = await currentUser();
  const scope = !user ? "login_required" : user.locationId == null ? "location_missing" : "location";
  const headers = { "Cache-Control": "private, no-store" };
  if (scope !== "location") return NextResponse.json({ birthdays: [], hires: [], scope }, { headers });
  const out: Record<string, unknown> = {};
  const selected = await Promise.all((["birthday", "hire"] as const).map(async (kind) => {
    const cfg = await getCfg(kind);
    return { kind, cfg, rows: visible(await candidates(kind, effectiveWindow(kind, cfg)), cfg).filter((row) => row.locationId === user!.locationId) };
  }));
  const ids = [...new Set(selected.flatMap(({ rows }) => rows.map((r) => r.id)))];
  const photos = ids.length ? await db.setting.findMany({ where: { key: { in: ids.map((id) => `portal.person.photo.${id}`) } }, select: { key: true, value: true } }) : [];
  const photoByKey = new Map(photos.map((p) => [p.key, p.value]));
  for (const { kind: k, cfg, rows } of selected) {
    out[k === "birthday" ? "birthdays" : "hires"] = rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, title: r.title, days: r.days, label: r.label, note: noteOf(k, cfg, r), photo: photoByKey.get(`portal.person.photo.${r.id}`) || null }));
  }
  return NextResponse.json({ ...out, scope }, { headers });
}
