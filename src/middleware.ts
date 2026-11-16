import { NextResponse, type NextRequest } from "next/server";

// فقط وجود کوکی را بررسی می‌کند؛ اعتبار نشست در خود API/صفحه‌ها بررسی می‌شود.
// ورود، لابی و API عمومی آزادند؛ اعتبار نشست در صفحه‌ها بررسی می‌شود.
const OPEN = ["/login", "/lobby", "/api/auth/login", "/api/weather", "/api/portal", "/api/lobby/rates", "/api/lobby/display"];

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p === "/api/itsm/test-identity" && process.env.ITSM_TEST_ISOLATED === "1") return NextResponse.next();
  const open = !p.startsWith("/lobby/admin") && OPEN.some((o) => p === o || (o !== "/" && p.startsWith(o + "/")));
  if (open) return NextResponse.next();
  if (req.cookies.get("apadana_session")) return NextResponse.next();
  if (p.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", p);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next|brand|static|favicon|.*\\..*).*)"] };
