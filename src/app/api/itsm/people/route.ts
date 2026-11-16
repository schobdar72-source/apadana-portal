import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  if (!auth.user.locationId) return NextResponse.json({ error: "محل خدمت شما مشخص نیست." }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return NextResponse.json([]);
  const words = query.split(/\s+/).slice(0, 5);
  const people = await db.employee.findMany({ where: { active: true, locationId: auth.user.locationId, id: { not: auth.user.id }, AND: words.map((word) => ({ OR: [{ firstName: { contains: word, mode: "insensitive" as const } }, { lastName: { contains: word, mode: "insensitive" as const } }, { code: { contains: word } }] })) }, select: { id: true, code: true, firstName: true, lastName: true, positionTitle: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 20 });
  return NextResponse.json(people, { headers: { "Cache-Control": "private, no-store" } });
}
