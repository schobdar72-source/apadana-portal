import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string; fileId: string } }) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const id = Number(params.id); const fileId = Number(params.fileId);
  if (![id, fileId].every((value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647)) return NextResponse.json({ error: "فایل یافت نشد." }, { status: 404 });
  const files = await db.$queryRaw<{ filename: string; content: Buffer }[]>`SELECT a."filename", a."content" FROM "ItsmAttachment" a JOIN "ItsmTicket" t ON t."id" = a."ticketId" WHERE t."id" = ${id} AND a."id" = ${fileId} AND (t."requesterId" = ${auth.user.id} OR t."beneficiaryId" = ${auth.user.id} OR t."assigneeId" = ${auth.user.id} OR ${queueTicketAccess(auth.user.id, auth.user.locationId)} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId" = ${auth.user.id} AND r."role" = 'it_manager'))`;
  if (!files.length) return NextResponse.json({ error: "فایل یافت نشد." }, { status: 404 });
  return new Response(new Uint8Array(files[0].content).buffer, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(files[0].filename)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
import { queueTicketAccess } from "@/lib/itsm/queue-access";
