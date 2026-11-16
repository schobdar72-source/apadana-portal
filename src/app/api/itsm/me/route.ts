import { NextResponse } from "next/server";
import { getItsmIdentity } from "@/lib/itsm/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getItsmIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json(identity, { headers: { "Cache-Control": "private, no-store" } });
}
