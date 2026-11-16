import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { can } from "@/config/roles";
import { categoryPrefix, documentPrefix, filePrefix, canViewCategory, type Category, type DocumentItem } from "@/lib/documents";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string; kind: string } }) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const { id, kind } = params;
  if (!/^[a-f0-9-]{36}$/.test(id) || (kind !== "pdf" && kind !== "original")) return new NextResponse(null, { status: 404 });
  try {
    const record = await db.setting.findUnique({ where: { key: documentPrefix + id } });
    if (!record) return new NextResponse(null, { status: 404 });
    const item = JSON.parse(record.value) as DocumentItem;
    const categoryRecord = await db.setting.findUnique({ where: { key: categoryPrefix + item.categoryId } });
    if (!categoryRecord || !canViewCategory(JSON.parse(categoryRecord.value) as Category, auth.user) || (!item.active && !can(auth.user.role, "system.config"))) return new NextResponse(null, { status: 404 });
    const metadata = item[kind];
    if (!metadata) return new NextResponse(null, { status: 404 });
    const file = await db.setting.findUnique({ where: { key: `${filePrefix}${id}.${kind}` } });
    if (!file) return new NextResponse(null, { status: 404 });
    const filename = encodeURIComponent(metadata.name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    const inline = kind === "pdf" && new URL(request.url).searchParams.get("preview") === "1";
    return new NextResponse(Buffer.from(file.value, "base64"), { headers: { "Content-Type": kind === "pdf" ? "application/pdf" : "application/octet-stream", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="document.${kind === "pdf" ? "pdf" : "doc"}"; filename*=UTF-8''${filename}`, "Content-Security-Policy": "sandbox", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
  } catch { return new NextResponse(null, { status: 500 }); }
}
