import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { markFirstResponse, transitionSla, txNow } from "@/lib/itsm/sla-runtime";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const valid = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!valid(id)) return NextResponse.json({ error: "درخواست یافت نشد." }, { status: 404, headers });
  const messages = await db.$queryRaw`SELECT m."id", m."body", m."internal", m."createdAt", e."firstName", e."lastName" FROM "ItsmMessage" m JOIN "ItsmTicket" t ON t."id" = m."ticketId" JOIN "Employee" e ON e."id" = m."authorId" WHERE t."id" = ${id} AND (t."requesterId" = ${auth.user.id} OR t."beneficiaryId" = ${auth.user.id} OR t."assigneeId" = ${auth.user.id} OR ${queueTicketAccess(auth.user.id, auth.user.locationId)} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'it_manager')) AND (m."internal" = false OR t."assigneeId" = ${auth.user.id} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'it_manager')) ORDER BY m."createdAt", m."id"`;
  return NextResponse.json(messages, { headers });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!valid(id)) return NextResponse.json({ error: "درخواست یافت نشد." }, { status: 404, headers });
  let data: { body?: unknown; internal?: unknown };
  try { data = await request.json(); } catch { return NextResponse.json({ error: "پیام معتبر نیست." }, { status: 400, headers }); }
  if (!data || typeof data.body !== "string" || data.body.trim().length < 1 || data.body.length > 10000 || (data.internal !== undefined && typeof data.internal !== "boolean")) return NextResponse.json({ error: "پیام معتبر نیست." }, { status: 400, headers });
  const internal = data.internal === true;
  const message = data.body.trim();
  const saved = await db.$transaction(async (transaction) => {
    const tickets = await transaction.$queryRaw<{ assigneeId: number | null; requesterId: number; beneficiaryId: number; status: string }[]>`SELECT "assigneeId", "requesterId", "beneficiaryId", "status" FROM "ItsmTicket" WHERE "id" = ${id} FOR UPDATE`;
    const ticket = tickets[0];
    if (!ticket || ["closed", "cancelled", "resolved"].includes(ticket.status)) return false;
    const assignee = ticket.assigneeId === auth.user.id;
    const participant = ticket.requesterId === auth.user.id || ticket.beneficiaryId === auth.user.id;
    if ((!assignee && (!participant || ticket.status !== "waiting_user")) || (internal && !assignee)) return false;
    await transaction.$executeRaw`INSERT INTO "ItsmMessage" ("ticketId", "authorId", "body", "internal") VALUES (${id}, ${auth.user.id}, ${message}, ${internal})`;
    const now=await txNow(transaction);
    if(assignee&&!internal)await markFirstResponse(transaction,id,auth.user.id,now);
    if (!assignee && ticket.status === "waiting_user") {await transitionSla(transaction,id,auth.user.id,now,'resume');await transaction.$executeRaw`UPDATE "ItsmTicket" SET "status" = 'in_progress', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}`;}
    await transaction.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${id}, ${auth.user.id}, ${internal ? "internal_message" : "message"})`;
    return true;
  });
  return saved ? NextResponse.json({ ok: true }, { headers }) : NextResponse.json({ error: "ثبت پیام در وضعیت فعلی مجاز نیست." }, { status: 403, headers });
}
import { queueTicketAccess } from "@/lib/itsm/queue-access";
