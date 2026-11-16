import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm, requireUser } from "@/lib/guard";
import { can } from "@/config/roles";

export const dynamic = "force-dynamic";
const prefix = "hr.notice.";
const contactKey = "hr.contact.v1";
type Notice = { id: string; title: string; body: string; active: boolean; createdAt: string; locationIds?: number[]; demoBatch?: string };
type Contact = { phone: string; extension: string; email: string; details: string };
const blank: Contact = { phone: "", extension: "", email: "", details: "" };
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length <= max ? v.trim() : null;
function parseNotice(value: string): Notice | null {
  try {
    const n = JSON.parse(value);
    if (n.locationIds !== undefined && (!Array.isArray(n.locationIds) || n.locationIds.some((id: unknown) => !Number.isInteger(id) || Number(id) <= 0))) return null;
    return typeof n.id === "string" && typeof n.title === "string" && typeof n.body === "string" && typeof n.active === "boolean" && typeof n.createdAt === "string" ? { ...n, locationIds: Array.isArray(n.locationIds) ? n.locationIds.filter((id: unknown) => Number.isInteger(id) && Number(id) > 0) : [] } : null;
  } catch { return null; }
}
function parseContact(value?: string): Contact {
  try {
    const c = value ? JSON.parse(value) : {};
    return { phone: text(c.phone, 60) || "", extension: text(c.extension, 30) || "", email: text(c.email, 254) || "", details: text(c.details, 500) || "" };
  } catch { return blank; }
}

export async function GET() {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const manager = can(auth.user.role, "org.manage");
  const [rows, contact, locations] = await Promise.all([
    db.setting.findMany({ where: { key: { startsWith: prefix } } }),
    db.setting.findUnique({ where: { key: contactKey } }),
    manager ? db.location.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const matchesViewer = (n: Notice) => n.active && (!n.locationIds?.length || (auth.user.locationId != null && n.locationIds.includes(auth.user.locationId)));
  const notices = rows.map((r) => parseNotice(r.value)).filter((n): n is Notice => !!n && (manager || matchesViewer(n))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ notices, visibleNoticeIds: notices.filter(matchesViewer).map(n => n.id), contact: parseContact(contact?.value), locations }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requirePerm("org.manage");
  if (auth.err) return auth.err;
  let body: Record<string, unknown>;
  try { body = await request.json(); if (!body || typeof body !== "object") throw new Error(); }
  catch { return NextResponse.json({ error: "داده ارسالی معتبر نیست." }, { status: 400 }); }

  if (body.action === "contact") {
    const phone = text(body.phone, 60), extension = text(body.extension, 30), email = text(body.email, 254), details = text(body.details, 500);
    if (phone === null || extension === null || email === null || details === null || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: "اطلاعات تماس یا ایمیل معتبر نیست." }, { status: 400 });
    await db.setting.upsert({ where: { key: contactKey }, create: { key: contactKey, value: JSON.stringify({ phone, extension, email, details }) }, update: { value: JSON.stringify({ phone, extension, email, details }) } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "saveNotice") {
    const title = text(body.title, 120), noticeBody = text(body.body, 2000);
    if (!title || !noticeBody || typeof body.active !== "boolean") return NextResponse.json({ error: "عنوان و متن اطلاعیه الزامی هستند؛ طول عنوان حداکثر ۱۲۰ و متن ۲۰۰۰ نویسه است." }, { status: 400 });
    if (body.id !== undefined && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id))) return NextResponse.json({ error: "شناسه اطلاعیه نامعتبر است." }, { status: 400 });
    const id = typeof body.id === "string" ? body.id : randomUUID();
    const existing = body.id ? await db.setting.findUnique({ where: { key: prefix + id } }) : null;
    if (body.id && !existing) return NextResponse.json({ error: "اطلاعیه پیدا نشد." }, { status: 404 });
    const createdAt = existing ? parseNotice(existing.value)?.createdAt : new Date().toISOString();
    if (!createdAt) return NextResponse.json({ error: "اطلاعیه قابل خواندن نیست." }, { status: 409 });
    if (body.locationIds !== undefined && (!Array.isArray(body.locationIds) || body.locationIds.some(id => !Number.isInteger(id) || id <= 0))) return NextResponse.json({ error: "محل خدمت نامعتبر است." }, { status: 400 });
    const locationIds = [...new Set((body.locationIds as number[] | undefined) || [])];
    if (locationIds.length && await db.location.count({ where: { id: { in: locationIds }, active: true } }) !== locationIds.length) return NextResponse.json({ error: "محل خدمت انتخاب‌شده معتبر نیست." }, { status: 400 });
    const old = existing ? parseNotice(existing.value) : null;
    const value = JSON.stringify({ id, title, body: noticeBody, active: body.active, createdAt, locationIds, ...(old?.demoBatch ? { demoBatch: old.demoBatch } : {}) });
    await db.setting.upsert({ where: { key: prefix + id }, create: { key: prefix + id, value }, update: { value } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "deleteNotice" && typeof body.id === "string" && /^[0-9a-f-]{36}$/.test(body.id)) {
    await db.setting.deleteMany({ where: { key: prefix + body.id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
}
