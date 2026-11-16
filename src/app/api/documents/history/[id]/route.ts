import { NextResponse } from "next/server";
import { requirePerm } from "@/lib/guard";
import { historyPrefix, readSettings } from "@/lib/documents";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requirePerm("system.config");
  if (auth.err) return auth.err;
  if (!/^[a-f0-9-]{36}$/.test(params.id)) return new NextResponse(null, { status: 404 });
  const history = await readSettings<{ version: number; updatedAt: string; updatedBy: string; action: string; files: string[] }>(`${historyPrefix}${params.id}.`);
  return NextResponse.json({ history: history.sort((first, second) => second.version - first.version) }, { headers: { "Cache-Control": "private, no-store" } });
}
