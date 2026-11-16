import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type EventRow = { id: number; ticketId: number; action: string; title: string; createdAt: Date; readAt: string | null; queueOnly: boolean };
type SlaRow = { id: number; ticketId: number; title: string; createdAt: Date; readAt: Date | null };
type ReportRow = { id: number; profileName: string; createdAt: Date; readAt: Date | null };

function eventFilter(employeeId: number, locationId: number | null) {
  return Prisma.sql`e."actorId" <> ${employeeId}
    AND (e."action" IN ('created', 'claimed', 'assigned', 'message', 'attachment_added', 'transferred', 'transfer_accepted', 'transfer_rejected') OR e."action" LIKE 'status:%')
    AND (t."requesterId" = ${employeeId} OR t."beneficiaryId" = ${employeeId} OR t."assigneeId" = ${employeeId}
      OR (e."action" IN ('created', 'transferred', 'transfer_accepted', 'transfer_rejected') AND t."status" = 'waiting_assignment' AND t."assigneeId" IS NULL AND t."locationId" = ${locationId}
        AND EXISTS (SELECT 1 FROM "ItsmGroupMembership" m JOIN "ItsmGroup" g ON g."id" = m."groupId" AND g."active" = true JOIN "ItsmRoleGrant" r ON r."employeeId" = m."employeeId" AND r."role" IN ('technician', 'group_head') WHERE m."employeeId" = ${employeeId} AND m."groupId" = t."groupId")))`;
}
function label(action: string, queueOnly: boolean) {
  if (queueOnly) return "درخواست جدید در صف واحد";
  if (action === "created") return "درخواست جدید برای شما ثبت شد";
  if (action === "claimed") return "کارشناس رسیدگی به درخواست را پذیرفت";
  if (action === "assigned") return "درخواست به کارشناس اختصاص یافت";
  if (action === "message") return "پیام جدید در درخواست";
  if (action === "attachment_added") return "فایل جدید به درخواست اضافه شد";
  if (action === "transferred") return "درخواست برای ادامه رسیدگی ارجاع شد";
  if (action.startsWith("status:")) return "وضعیت درخواست تغییر کرد";
  return "وضعیت ارجاع درخواست تغییر کرد";
}
export async function GET() {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const employeeId = auth.user.id, prefix = `itsm.notifications.event.read.${employeeId}.`;
  const filter = eventFilter(employeeId, auth.user.locationId);
  const [events, eventCount, sla, slaCount, reports, reportCount] = await Promise.all([
    db.$queryRaw<EventRow[]>`SELECT e."id", e."ticketId", e."action", e."createdAt", t."title", s."value" AS "readAt", NOT (t."requesterId" = ${employeeId} OR t."beneficiaryId" = ${employeeId} OR COALESCE(t."assigneeId" = ${employeeId}, false)) AS "queueOnly" FROM "ItsmTicketEvent" e JOIN "ItsmTicket" t ON t."id" = e."ticketId" LEFT JOIN "Setting" s ON s."key" = ${prefix} || e."id"::text WHERE ${filter} ORDER BY e."createdAt" DESC, e."id" DESC LIMIT 50`,
    db.$queryRaw<{count:number}[]>`SELECT COUNT(*)::int AS "count" FROM "ItsmTicketEvent" e JOIN "ItsmTicket" t ON t."id" = e."ticketId" LEFT JOIN "Setting" s ON s."key" = ${prefix} || e."id"::text WHERE ${filter} AND s."key" IS NULL`,
    db.$queryRaw<SlaRow[]>`SELECT n."id", n."ticketId", n."createdAt", n."readAt", t."title" FROM "ItsmSlaNotice" n JOIN "ItsmTicket" t ON t."id" = n."ticketId" WHERE n."recipientId" = ${employeeId} AND t."assigneeId" = ${employeeId} ORDER BY n."createdAt" DESC, n."id" DESC LIMIT 50`,
    db.$queryRaw<{count:number}[]>`SELECT COUNT(*)::int AS "count" FROM "ItsmSlaNotice" n JOIN "ItsmTicket" t ON t."id" = n."ticketId" WHERE n."recipientId" = ${employeeId} AND t."assigneeId" = ${employeeId} AND n."readAt" IS NULL`,
    db.$queryRaw<ReportRow[]>`SELECT "id", "profileName", "createdAt", "readAt" FROM "ItsmReportRun" WHERE "employeeId" = ${employeeId} ORDER BY "createdAt" DESC, "id" DESC LIMIT 50`,
    db.$queryRaw<{count:number}[]>`SELECT COUNT(*)::int AS "count" FROM "ItsmReportRun" WHERE "employeeId" = ${employeeId} AND "readAt" IS NULL`,
  ]);
  const items = [
    ...events.map((event) => ({ id: event.id, kind: "event", ticketId: event.ticketId, title: label(event.action, event.queueOnly), detail: event.title, createdAt: event.createdAt, read: !!event.readAt, destination: event.queueOnly ? "queue" : "ticket" })),
    ...sla.map((item) => ({ id: item.id, kind: "sla", ticketId: item.ticketId, title: "هشدار مهلت رسیدگی", detail: item.title, createdAt: item.createdAt, read: !!item.readAt, destination: "ticket" })),
    ...reports.map((item) => ({ id: item.id, kind: "report", ticketId: null, title: "گزارش زمان‌بندی‌شده آماده است", detail: item.profileName, createdAt: item.createdAt, read: !!item.readAt, destination: "reports" })),
  ].sort((first, second) => +new Date(second.createdAt) - +new Date(first.createdAt)).slice(0, 50);
  return NextResponse.json({ items, unreadCount: eventCount[0].count + slaCount[0].count + reportCount[0].count }, { headers });
}
export async function POST(request: Request) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  let body: {kind?:unknown; id?:unknown};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400, headers }); }
  if (!body || typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id < 1 || body.id > 2147483647 || !["event", "sla", "report"].includes(String(body.kind))) return NextResponse.json({ error: "اعلان معتبر نیست." }, { status: 400, headers });
  const id = body.id, employeeId = auth.user.id;
  if (body.kind === "event") {
    const filter = eventFilter(employeeId, auth.user.locationId);
    const rows = await db.$queryRaw<{id:number}[]>`SELECT e."id" FROM "ItsmTicketEvent" e JOIN "ItsmTicket" t ON t."id" = e."ticketId" WHERE e."id" = ${id} AND ${filter}`;
    if (!rows.length) return NextResponse.json({ error: "اعلان پیدا نشد." }, { status: 404, headers });
    const key = `itsm.notifications.event.read.${employeeId}.${id}`;
    await db.setting.upsert({ where: { key }, create: { key, value: new Date().toISOString() }, update: {} });
  } else if (body.kind === "sla") {
    const rows = await db.$queryRaw<{id:number}[]>`UPDATE "ItsmSlaNotice" n SET "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP) FROM "ItsmTicket" t WHERE n."id" = ${id} AND n."ticketId" = t."id" AND n."recipientId" = ${employeeId} AND t."assigneeId" = ${employeeId} RETURNING n."id"`;
    if (!rows.length) return NextResponse.json({ error: "اعلان پیدا نشد." }, { status: 404, headers });
  } else {
    const rows = await db.$queryRaw<{id:number}[]>`UPDATE "ItsmReportRun" SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP) WHERE "id" = ${id} AND "employeeId" = ${employeeId} RETURNING "id"`;
    if (!rows.length) return NextResponse.json({ error: "اعلان پیدا نشد." }, { status: 404, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
