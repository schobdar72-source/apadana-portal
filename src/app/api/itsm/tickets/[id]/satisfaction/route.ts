import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: "تیکت معتبر نیست." }, { status: 400, headers });
  const rows = await db.$queryRaw<{status:string; satisfaction:number|null; satisfactionNote:string; participant:boolean}[]>`SELECT t."status", t."satisfaction", t."satisfactionNote", (t."requesterId"=${auth.user.id} OR t."beneficiaryId"=${auth.user.id}) AS "participant" FROM "ItsmTicket" t WHERE t."id"=${id} AND (t."requesterId"=${auth.user.id} OR t."beneficiaryId"=${auth.user.id} OR t."assigneeId"=${auth.user.id} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId"=${auth.user.id} AND r."role"='it_manager'))`;
  if (!rows.length) return NextResponse.json({ visible: false }, { headers });
  const row = rows[0];
  return NextResponse.json({ visible: row.status === "closed", score: row.satisfaction, note: row.satisfactionNote, canRate: row.participant && row.status === "closed" && row.satisfaction === null }, { headers });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({ error: "تیکت معتبر نیست." }, { status: 400, headers });
  let data: unknown;
  try { data = await request.json(); } catch { return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400, headers }); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return NextResponse.json({ error: "اطلاعات معتبر نیست." }, { status: 400, headers });
  const { score, note } = data as Record<string, unknown>;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5 || typeof note !== "string" || note.trim().length > 500) return NextResponse.json({ error: "امتیاز و نظر معتبر وارد کنید." }, { status: 400, headers });
  const updated = await db.$queryRaw<{id:number}[]>`UPDATE "ItsmTicket" SET "satisfaction"=${score}, "satisfactionNote"=${note.trim()}, "satisfiedAt"=CURRENT_TIMESTAMP, "satisfiedById"=${auth.user.id} WHERE "id"=${id} AND "status"='closed' AND "satisfaction" IS NULL AND ("requesterId"=${auth.user.id} OR "beneficiaryId"=${auth.user.id}) RETURNING "id"`;
  if (!updated.length) return NextResponse.json({ error: "ثبت نظر برای این تیکت مجاز نیست یا قبلاً ثبت شده است." }, { status: 409, headers });
  return NextResponse.json({ ok: true }, { headers });
}
