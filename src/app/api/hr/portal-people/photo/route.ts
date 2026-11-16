import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireHr } from "@/lib/guard";

// Photos are optional and displayed only with people already selected for the public portal.
export async function PUT(req: Request) {
  const auth = await requireHr();
  if (auth.err) return auth.err;
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const photo = body?.photo;
  if (!Number.isSafeInteger(id) || id < 1 || !(photo === null || typeof photo === "string")) return NextResponse.json({ error: "invalid data" }, { status: 400 });
  const employee = await db.employee.findUnique({ where: { id }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: "not found" }, { status: 404 });
  const key = `portal.person.photo.${id}`;
  if (photo === null) {
    await db.setting.deleteMany({ where: { key } });
    return NextResponse.json({ ok: true });
  }
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
  if (!match || match[2].length > 205000) return NextResponse.json({ error: "invalid image" }, { status: 400 });
  const bytes = Buffer.from(match[2], "base64");
  const valid = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid || bytes.length > 150 * 1024) return NextResponse.json({ error: "invalid image" }, { status: 400 });
  await db.setting.upsert({ where: { key }, create: { key, value: photo }, update: { value: photo } });
  return NextResponse.json({ ok: true });
}
