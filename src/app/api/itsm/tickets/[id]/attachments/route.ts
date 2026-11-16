import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const valid = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id); if (!valid(id)) return NextResponse.json({ error: "درخواست یافت نشد." }, { status: 404, headers });
  const files = await db.$queryRaw`SELECT a."id", a."filename", a."size", a."createdAt" FROM "ItsmAttachment" a JOIN "ItsmTicket" t ON t."id" = a."ticketId" WHERE t."id" = ${id} AND (t."requesterId" = ${auth.user.id} OR t."beneficiaryId" = ${auth.user.id} OR t."assigneeId" = ${auth.user.id} OR ${queueTicketAccess(auth.user.id, auth.user.locationId)} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'it_manager')) ORDER BY a."id"`;
  return NextResponse.json(files, { headers });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id); if (!valid(id)) return NextResponse.json({ error: "درخواست یافت نشد." }, { status: 404, headers });
  if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024) return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است." }, { status: 413, headers });
  let file: FormDataEntryValue | null;
  try { file = (await request.formData()).get("file"); } catch { return NextResponse.json({ error: "فایل معتبر نیست." }, { status: 400, headers }); }
  if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024 || !/\.(pdf|png|jpe?g|docx|xlsx)$/i.test(file.name)) return NextResponse.json({ error: "فایل مجاز با حداکثر حجم ۵ مگابایت انتخاب کنید." }, { status: 400, headers });
  const filename = file.name.replace(/[\u0000-\u001f/\\]/g, "_").slice(-150);
  const content = Buffer.from(await file.arrayBuffer());
  const uploaded = await db.$transaction(async (transaction) => {
    const tickets = await transaction.$queryRaw<{ status: string; requesterId: number; beneficiaryId: number; assigneeId: number | null }[]>`SELECT "status", "requesterId", "beneficiaryId", "assigneeId" FROM "ItsmTicket" WHERE "id" = ${id} FOR UPDATE`;
    const ticket = tickets[0]; if (!ticket) return false;
    const assignee = ticket.assigneeId === auth.user.id && ["in_progress", "waiting_user"].includes(ticket.status);
    const participant = (ticket.requesterId === auth.user.id || ticket.beneficiaryId === auth.user.id) && ["waiting_assignment", "waiting_user"].includes(ticket.status);
    if (!assignee && !participant) return false;
    const count = await transaction.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS "count" FROM "ItsmAttachment" WHERE "ticketId" = ${id}`;
    if (count[0].count >= BigInt(10)) return false;
    await transaction.$executeRaw`INSERT INTO "ItsmAttachment" ("ticketId", "uploaderId", "filename", "size", "content") VALUES (${id}, ${auth.user.id}, ${filename}, ${file.size}, ${content})`;
    await transaction.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${id}, ${auth.user.id}, 'attachment_added')`;
    return true;
  });
  return uploaded ? NextResponse.json({ ok: true }, { headers }) : NextResponse.json({ error: "افزودن پیوست مجاز نیست یا تعداد پیوست‌ها به سقف رسیده است." }, { status: 403, headers });
}
import { queueTicketAccess } from "@/lib/itsm/queue-access";
