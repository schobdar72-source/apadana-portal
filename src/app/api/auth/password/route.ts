import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { currentUser, validPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { current, next } = await req.json().catch(() => ({}));
  if (typeof current !== "string" || typeof next !== "string")
    return NextResponse.json({ error: "اطلاعات ناقص است." }, { status: 400 });
  const row = await db.employee.findUnique({ where: { id: u.id } });
  if (!row || !(await bcrypt.compare(current, row.passwordHash)))
    return NextResponse.json({ error: "رمز فعلی نادرست است." }, { status: 400 });
  const err = validPassword(next, u.code);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  await db.employee.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 10), mustChangePass: false } });
  // سایر نشست‌ها بسته می‌شوند؛ نشست فعلی می‌ماند
  const keep = (await import("next/headers")).cookies().get("apadana_session")?.value;
  await db.session.deleteMany({ where: { employeeId: u.id, NOT: { id: keep ?? "" } } });
  return NextResponse.json({ ok: true });
}
