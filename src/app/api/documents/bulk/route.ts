import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";
import { documentPrefix, filePrefix, historyPrefix, readSettings, type DocumentItem } from "@/lib/documents";

export const dynamic = "force-dynamic";
const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id);
const normalize = (text: string) => text.toLocaleLowerCase("fa").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[۰-۹٠-٩]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit) >= 0 ? "۰۱۲۳۴۵۶۷۸۹".indexOf(digit) : "٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();

export async function POST(request: Request) {
  const auth = await requirePerm("system.config");
  if (auth.err) return auth.err;
  try {
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) return await bulkFiles(request, `${auth.user.firstName} ${auth.user.lastName}`.trim());
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? [...new Set<string>(body.ids.filter(validId))] : [];
    if (!ids.length || !["delete", "activate", "deactivate"].includes(body.op)) return error("درخواست نامعتبر است.");
    const documents = await readSettings<DocumentItem>(documentPrefix);
    const targets = documents.filter(item => ids.includes(item.id));
    if (!targets.length) return error("مدرکی پیدا نشد.", 404);
    const now = new Date().toISOString();
    const actor = `${auth.user.firstName} ${auth.user.lastName}`.trim();
    const ops = [];
    for (const item of targets) {
      if (body.op === "delete") { ops.push(db.setting.deleteMany({ where: { OR: [{ key: { in: [documentPrefix + item.id, `${filePrefix}${item.id}.pdf`, `${filePrefix}${item.id}.original`] } }, { key: { startsWith: `${historyPrefix}${item.id}.` } }] } })); continue; }
      const active = body.op === "activate";
      if (item.active === active) continue;
      ops.push(db.setting.update({ where: { key: documentPrefix + item.id }, data: { value: JSON.stringify({ ...item, active, updatedAt: now, updatedBy: actor }) } }));
      ops.push(db.setting.create({ data: { key: `${historyPrefix}${item.id}.${randomUUID()}`, value: JSON.stringify({ version: item.version || 1, updatedAt: now, updatedBy: actor, action: active ? "فعال‌سازی گروهی" : "غیرفعال‌سازی گروهی", files: [] }) } }));
    }
    if (ops.length) await db.$transaction(ops);
    return NextResponse.json({ ok: true, count: targets.length });
  } catch { return error("عملیات گروهی انجام نشد.", 500); }
}

async function bulkFiles(request: Request, actor: string) {
  const form = await request.formData();
  const categoryId = String(form.get("categoryId") || "");
  if (!validId(categoryId)) return error("دسته‌بندی معتبر را انتخاب کنید.");
  const uploads = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  if (!uploads.length) return error("فایلی انتخاب نشده است.");
  if (uploads.length > 30) return error("حداکثر ۳۰ فایل در هر بار مجاز است.");
  const documents = (await readSettings<DocumentItem>(documentPrefix)).filter(item => item.categoryId === categoryId);
  const byCode = new Map(documents.map(item => [normalize(item.code), item]));
  const results: { file: string; status: "ok" | "nomatch" | "invalid"; reason?: string }[] = [];
  for (const upload of uploads) {
    const ext = upload.name.toLowerCase().split(".").pop() || "";
    const kind = ext === "pdf" ? "pdf" : ["doc", "docx"].includes(ext) ? "original" : null;
    if (!kind) { results.push({ file: upload.name, status: "invalid", reason: "فقط PDF یا Word" }); continue; }
    if (upload.size > 10 * 1024 * 1024) { results.push({ file: upload.name, status: "invalid", reason: "حجم بیش از ۱۰ مگابایت" }); continue; }
    const item = byCode.get(normalize(upload.name.replace(/\.[^.]+$/, "")));
    if (!item) { results.push({ file: upload.name, status: "nomatch" }); continue; }
    const buffer = Buffer.from(await upload.arrayBuffer());
    if (kind === "pdf" ? buffer.subarray(0, 5).toString() !== "%PDF-" : ext === "docx" ? buffer.subarray(0, 4).toString("hex") !== "504b0304" : buffer.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1") { results.push({ file: upload.name, status: "invalid", reason: "محتوای فایل معتبر نیست" }); continue; }
    const filename = upload.name.replace(/[\x00-\x1f\\/]/g, "_").slice(-200);
    const now = new Date().toISOString();
    const next: DocumentItem = { ...item, updatedAt: now, updatedBy: actor, version: (item.version || 1) + 1, [kind]: { name: filename, size: upload.size } };
    await db.$transaction([
      db.setting.upsert({ where: { key: `${filePrefix}${item.id}.${kind}` }, create: { key: `${filePrefix}${item.id}.${kind}`, value: buffer.toString("base64") }, update: { value: buffer.toString("base64") } }),
      db.setting.update({ where: { key: documentPrefix + item.id }, data: { value: JSON.stringify(next) } }),
      db.setting.create({ data: { key: `${historyPrefix}${item.id}.${randomUUID()}`, value: JSON.stringify({ version: next.version, updatedAt: now, updatedBy: actor, action: "بارگذاری گروهی", files: [kind === "pdf" ? "PDF" : "Word"] }) } }),
    ]);
    results.push({ file: upload.name, status: "ok" });
  }
  return NextResponse.json({ updated: results.filter(result => result.status === "ok").length, results });
}
