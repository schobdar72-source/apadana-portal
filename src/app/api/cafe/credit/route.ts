import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requirePerm, requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";
const FILE = path.join(process.cwd(), "data", "cafe-credit.json");

/** GET: گروه‌های اعتبار و تخصیص کارکنان. PUT: ذخیره‌ی کامل. */
export async function GET() {
  const g = await requireUser(); if (g.err) return g.err;
  try { return NextResponse.json(JSON.parse(await fs.readFile(FILE, "utf8"))); } catch { return NextResponse.json(null); }
}
export async function PUT(req: Request) {
  const g = await requirePerm("cafe.manage"); if (g.err) return g.err;
  const body = await req.json();
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(body, null, 2), "utf8");
  return NextResponse.json(body);
}
