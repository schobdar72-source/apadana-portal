import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const categories = await db.$queryRaw<{ id: number; name: string; groupName: string }[]>`
    SELECT c."id", c."name", g."name" AS "groupName"
    FROM "ItsmCategory" c JOIN "ItsmGroup" g ON g."id" = c."groupId"
    WHERE c."active" = true AND g."active" = true ORDER BY c."name"
  `;
  return NextResponse.json(categories, { headers: { "Cache-Control": "private, no-store" } });
}
