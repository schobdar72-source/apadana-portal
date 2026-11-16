import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { normalizeEmployeeCode } from "@/lib/loginInput";

export async function POST(req: Request) {
  const { code, password } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || typeof password !== "string" || !code.trim() || !password)
    return NextResponse.json({ error: "کد پرسنلی و رمز عبور را وارد کنید." }, { status: 400 });
  const r = await login(normalizeEmployeeCode(code), password);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 401 });
  return NextResponse.json({ mustChangePass: r.mustChangePass });
}
