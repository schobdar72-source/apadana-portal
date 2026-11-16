import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { incomingTransferAccess } from "@/lib/itsm/transfer-access";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const rows = await db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::integer AS "count" FROM "ItsmTransfer" x JOIN "ItsmTicket" t ON t."id" = x."ticketId" WHERE x."state" = 'pending' AND ${incomingTransferAccess(auth.user.id, auth.user.locationId)}`;
  return NextResponse.json({ count: rows[0].count }, { headers: { "Cache-Control": "private, no-store" } });
}
