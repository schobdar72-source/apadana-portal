import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requirePerm, requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";
const FILE = path.join(process.cwd(), "data", "cafe-menu.json");

/** GET: منو و برنامه‌ی هفته. PUT: ذخیره‌ی کامل منو و برنامه‌ی هفته. */
export async function GET() {
  const g = await requireUser(); if (g.err) return g.err;
  try { return NextResponse.json(JSON.parse(await fs.readFile(FILE, "utf8"))); } catch { return NextResponse.json(null); }
}

export async function PUT(req: Request) {
  const g = await requirePerm("cafe.manage"); if (g.err) return g.err;
  const body = await req.json();
  if (!Array.isArray(body.groups) || !body.groups.length || body.groups.some((x: unknown) => typeof x !== "string" || !x.trim()) || new Set(body.groups.map((x: string) => x.trim())).size !== body.groups.length || !Array.isArray(body.products) || body.products.some((p: any) => !p || typeof p.id !== "string" || typeof p.name !== "string" || !p.name.trim() || !body.groups.includes(p.category) || !Number.isSafeInteger(p.price) || p.price <= 0 || (p.available !== undefined && typeof p.available !== "boolean")) || !Array.isArray(body.week) || !Array.isArray(body.sides)) return NextResponse.json({ error: "اطلاعات منو معتبر نیست." }, { status: 400 });
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(body, null, 2), "utf8");
  return NextResponse.json(body);
}
