import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const COOKIE = "apadana_session";
const DAYS = 7;
const MAX_FAILS = 5;
const LOCK_MIN = 15;

export function validPassword(p: string, code: string): string | null {
  if (p.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد.";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "رمز عبور باید شامل حروف و عدد باشد.";
  if (p === code) return "رمز عبور نباید برابر کد پرسنلی باشد.";
  return null;
}

export async function login(code: string, password: string) {
  const u = await db.employee.findUnique({ where: { code } });
  const bad = { ok: false as const, error: "کد پرسنلی یا رمز عبور نادرست است." };
  if (!u || !u.active) return bad;
  if (u.lockedUntil && u.lockedUntil > new Date()) return { ok: false as const, error: "حساب به‌دلیل تلاش‌های ناموفق موقتاً قفل شده است. بعداً دوباره تلاش کنید." };
  if (!(await bcrypt.compare(password, u.passwordHash))) {
    const fails = u.failedAttempts + 1;
    await db.employee.update({
      where: { id: u.id },
      data: fails >= MAX_FAILS
        ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60000) }
        : { failedAttempts: fails },
    });
    return bad;
  }
  await db.employee.update({ where: { id: u.id }, data: { failedAttempts: 0, lockedUntil: null } });
  const id = randomBytes(32).toString("hex");
  await db.session.create({ data: { id, employeeId: u.id, expiresAt: new Date(Date.now() + DAYS * 86400000) } });
  cookies().set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAYS * 86400 });
  return { ok: true as const, mustChangePass: u.mustChangePass };
}

export async function currentUser() {
  const id = cookies().get(COOKIE)?.value;
  if (!id) return null;
  const s = await db.session.findUnique({ where: { id }, include: { employee: true } });
  if (!s || s.expiresAt < new Date() || !s.employee.active) return null;
  const { passwordHash, ...user } = s.employee;
  return user;
}

export async function logout() {
  const id = cookies().get(COOKIE)?.value;
  if (id) await db.session.deleteMany({ where: { id } });
  cookies().delete(COOKIE);
}
