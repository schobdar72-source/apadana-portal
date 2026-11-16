import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { queueTicketAccess } from "@/lib/itsm/queue-access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const labels: Record<string, string> = {
  created: "درخواست ثبت شد", claimed: "تیکت توسط کارشناس برداشته شد", assigned: "تیکت به کارشناس تخصیص یافت", transferred: "تیکت ارجاع شد", transfer_accepted: "ارجاع پذیرفته شد", transfer_rejected: "ارجاع رد شد", attachment_added: "فایل پیوست اضافه شد",
};
const statuses: Record<string, string> = { waiting_assignment: "در انتظار تخصیص", in_progress: "در حال انجام", waiting_user: "در انتظار پاسخ", waiting_action: "در انتظار اقدام", resolved: "حل‌شده", closed: "بسته‌شده", cancelled: "لغوشده" };

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: "تیکت پیدا نشد." }, { status: 404, headers });
  const access = await db.$queryRaw<{ id: number }[]>`SELECT t."id" FROM "ItsmTicket" t WHERE t."id" = ${id} AND (t."requesterId" = ${auth.user.id} OR t."beneficiaryId" = ${auth.user.id} OR t."assigneeId" = ${auth.user.id} OR ${queueTicketAccess(auth.user.id, auth.user.locationId)} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'it_manager'))`;
  if (!access.length) return NextResponse.json({ error: "تیکت پیدا نشد." }, { status: 404, headers });
  const events = await db.$queryRaw<{ id: number; action: string; createdAt: Date; actorName: string }[]>`SELECT e."id", e."action", e."createdAt", concat_ws(' ', actor."firstName", actor."lastName") AS "actorName" FROM "ItsmTicketEvent" e JOIN "Employee" actor ON actor."id" = e."actorId" WHERE e."ticketId" = ${id} AND (e."action" IN ('created', 'claimed', 'assigned', 'transferred', 'transfer_accepted', 'transfer_rejected', 'attachment_added') OR e."action" LIKE 'status:%') ORDER BY e."createdAt" DESC, e."id" DESC`;
  const history = events.flatMap((event) => {
    const status = event.action.startsWith("status:") ? event.action.split(":")[1] : "";
    const label = status ? (statuses[status] ? `وضعیت به «${statuses[status]}» تغییر کرد` : "") : labels[event.action];
    return label ? [{ id: event.id, label, actorName: event.actorName, createdAt: event.createdAt }] : [];
  });
  return NextResponse.json(history, { headers });
}
