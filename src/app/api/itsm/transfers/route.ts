import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { incomingTransferAccess } from "@/lib/itsm/transfer-access";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireUser(); if (auth.err) return auth.err;
  const transfers = await db.$queryRaw`SELECT x."id", x."ticketId", x."reason", x."note", x."createdAt", t."title", source."name" AS "source", destination."name" AS "destination" FROM "ItsmTransfer" x JOIN "ItsmTicket" t ON t."id" = x."ticketId" JOIN "ItsmGroup" source ON source."id" = x."sourceGroupId" JOIN "ItsmGroup" destination ON destination."id" = x."destinationGroupId" WHERE x."state" = 'pending' AND ${incomingTransferAccess(auth.user.id, auth.user.locationId)} ORDER BY x."createdAt", x."id" LIMIT 100`;
  return NextResponse.json(transfers, { headers: { "Cache-Control": "private, no-store" } });
}
