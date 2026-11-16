import { NextResponse } from "next/server";
import { currentUser } from "./auth";
import { can } from "@/config/roles";

/** کاربر واردشده با نشست معتبر؛ بدون بررسی مجوز. */
export async function requireUser() {
  const u = await currentUser();
  if (!u) return { err: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  return { user: u };
}

/** بررسی مجوز بر اساس نقش (config/roles.ts). کافی است کاربر یکی از مجوزها را داشته باشد. */
export async function requirePerm(...perms: string[]) {
  const u = await currentUser();
  if (!u) return { err: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!perms.some((p) => can(u.role, p))) return { err: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user: u };
}

/** مدیریت ساختار سازمانی (سازگار با کد قبلی). */
export const requireHr = () => requirePerm("org.manage");
