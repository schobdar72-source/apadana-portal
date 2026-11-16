import { NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/employeeConfig";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** توکن هرگز به مرورگر برگردانده نمی‌شود؛ فقط وجود آن اعلام می‌شود. */
export async function GET() {
  const g = await requirePerm("system.config"); if (g.err) return g.err;
  const c = await readConfig();
  return NextResponse.json({ source: c.source, apiUrl: c.apiUrl, hasToken: !!c.apiToken });
}

/** اگر apiToken ارسال نشود، توکن قبلی حفظ می‌شود. */
export async function PUT(req: Request) {
  const g = await requirePerm("system.config"); if (g.err) return g.err;
  const b = await req.json();
  const prev = await readConfig();
  const source = b.source === "api" ? "api" : "hr";
  const apiUrl = String(b.apiUrl ?? "").trim();
  if (source === "api" && !/^https?:\/\//i.test(apiUrl)) return NextResponse.json({ error: "آدرس API معتبر نیست" }, { status: 400 });
  const apiToken = typeof b.apiToken === "string" && b.apiToken !== "" ? b.apiToken.trim() : prev.apiToken;
  await writeConfig({ source, apiUrl, apiToken });
  return NextResponse.json({ source, apiUrl, hasToken: !!apiToken });
}
