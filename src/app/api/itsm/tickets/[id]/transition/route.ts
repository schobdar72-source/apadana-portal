import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { markFirstResponse, reopenSla, transitionSla, txNow } from "@/lib/itsm/sla-runtime";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: "درخواست یافت نشد." }, { status: 404 });
  let data: { status?: unknown; reason?: unknown; pauseReason?: unknown };
  try { data = await request.json(); } catch { return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400 }); }
  const status = data?.status;
  const detail = typeof data?.reason === "string" ? data.reason.trim() : "";
  const pauseReasons:Record<string,string>={info:'نیاز به اطلاعات بیشتر',approval:'در انتظار تأیید کاربر',access:'در انتظار دسترسی کاربر',other:'سایر'};
  const pauseCode=typeof data?.pauseReason==='string'?data.pauseReason:'';
  if (typeof status !== "string" || !["waiting_user", "in_progress", "resolved", "closed", "cancelled"].includes(status) || detail.length>500 || (status==='cancelled'&&!detail) || (status==='waiting_user'&&(!pauseReasons[pauseCode]||!detail))) return NextResponse.json({ error: "وضعیت یا دلیل معتبر نیست." }, { status: 400 });
  const reason=status==='waiting_user'?`${pauseReasons[pauseCode]}${detail?` — ${detail}`:''}`:detail;
  const updated = await db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<{ requesterId: number; beneficiaryId: number; assigneeId: number | null; status: string }[]>`SELECT "requesterId", "beneficiaryId", "assigneeId", "status" FROM "ItsmTicket" WHERE "id" = ${id} FOR UPDATE`;
    const ticket = rows[0];
    if (!ticket || ["closed", "cancelled"].includes(ticket.status)) return false;
    const owner = ticket.requesterId === auth.user.id || ticket.beneficiaryId === auth.user.id;
    const assignee = ticket.assigneeId === auth.user.id;
    const reopening = status === "in_progress" && ticket.status === "resolved" && owner && !!detail;
    if (!(status === "cancelled" && owner) && !reopening && !(assignee && ((status === "waiting_user" && ticket.status === "in_progress") || (status === "in_progress" && ticket.status === "waiting_user") || (status === "resolved" && ticket.status === "in_progress") || (status === "closed" && ["in_progress", "resolved"].includes(ticket.status))))) return false;
    if(status==='waiting_user') {
      const now = await txNow(transaction);
      await transaction.$executeRaw`INSERT INTO "ItsmMessage" ("ticketId", "authorId", "body", "internal") VALUES (${id}, ${auth.user.id}, ${`در انتظار پاسخ: ${detail}`}, false)`;
      await markFirstResponse(transaction,id,auth.user.id,now);
      await transitionSla(transaction,id,auth.user.id,now,'pause');
    }
    if(reopening) {
      await transaction.$executeRaw`INSERT INTO "ItsmMessage" ("ticketId", "authorId", "body", "internal") VALUES (${id}, ${auth.user.id}, ${`درخواست بررسی دوباره: ${detail}`}, false)`;
      await reopenSla(transaction,id,auth.user.id,await txNow(transaction));
    } else if(status==='in_progress') await transitionSla(transaction,id,auth.user.id,await txNow(transaction),'resume');
    if (status === 'closed' && detail) {
      const now = await txNow(transaction);
      await transaction.$executeRaw`INSERT INTO "ItsmMessage" ("ticketId", "authorId", "body", "internal") VALUES (${id}, ${auth.user.id}, ${detail}, false)`;
      await markFirstResponse(transaction,id,auth.user.id,now);
    }
    if(status==='resolved'||status==='closed') await transitionSla(transaction,id,auth.user.id,await txNow(transaction),'resolved');
    if(status==='cancelled') await transitionSla(transaction,id,auth.user.id,await txNow(transaction),'cancelled');
    await transaction.$executeRaw`UPDATE "ItsmTicket" SET "status" = ${status}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}`;
    await transaction.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${id}, ${auth.user.id}, ${`status:${status}${reason ? `:${reason}` : ""}`})`;
    return true;
  });
  return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "تغییر وضعیت مجاز نیست." }, { status: 403 });
}
