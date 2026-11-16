import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePerm } from "@/lib/guard";
import { can } from "@/config/roles";
import { categoryPrefix, documentPrefix, filePrefix, historyPrefix, canViewCategory, readSettings, type Category, type DocumentItem } from "@/lib/documents";

export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store" };
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id);
const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const manager = can(auth.user.role, "system.config");
  const [allCategories, allDocuments] = await Promise.all([readSettings<Category>(categoryPrefix), readSettings<DocumentItem>(documentPrefix)]);
  const categories = allCategories.filter(category => canViewCategory(category, auth.user)).sort((a, b) => a.name.localeCompare(b.name, "fa"));
  const visible = new Set(categories.map(category => category.id));
  const documents = allDocuments.filter(item => visible.has(item.categoryId) && (manager || item.active)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const safeCategories = manager ? categories : categories.map(({ id, name, active }) => ({ id, name, active }));
  if (!manager) return NextResponse.json({ categories: safeCategories, documents }, { headers: noCache });
  const [units, employees, locations] = await Promise.all([
    db.orgUnit.findMany({ where: { active: true }, select: { id: true, name: true, locationId: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { active: true }, select: { id: true, code: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
    db.location.findMany({ select: { id: true, name: true } }),
  ]);
  return NextResponse.json({ categories: safeCategories, documents, units, employees, locations }, { headers: noCache });
}

export async function POST(request: Request) {
  const auth = await requirePerm("system.config");
  if (auth.err) return auth.err;
  try {
    const body = await request.json();
    if (body.action !== "category") return error("درخواست نامعتبر است.");
    if (body.id && !validId(body.id)) return error("شناسه نامعتبر است.");
    const id = body.id || randomUUID();
    if (body.id && !(await db.setting.findUnique({ where: { key: categoryPrefix + id } }))) return error("دسته‌بندی پیدا نشد.", 404);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100 || typeof body.active !== "boolean" || typeof body.everyone !== "boolean" || !Array.isArray(body.unitIds) || !Array.isArray(body.employeeIds) || !body.unitIds.every(Number.isSafeInteger) || !body.employeeIds.every(Number.isSafeInteger)) return error("اطلاعات دسته‌بندی معتبر نیست.");
    if (!body.everyone && !body.unitIds.length && !body.employeeIds.length) return error("حداقل یک واحد یا همکار را انتخاب کنید.");
    const [units, employees] = await Promise.all([db.orgUnit.count({ where: { id: { in: body.unitIds }, active: true } }), db.employee.count({ where: { id: { in: body.employeeIds }, active: true } })]);
    if (units !== new Set(body.unitIds).size || employees !== new Set(body.employeeIds).size) return error("واحد یا همکار انتخاب‌شده معتبر نیست.");
    const category: Category = { id, name, active: body.active, everyone: body.everyone, unitIds: [...new Set<number>(body.unitIds)], employeeIds: [...new Set<number>(body.employeeIds)] };
    await db.setting.upsert({ where: { key: categoryPrefix + id }, create: { key: categoryPrefix + id, value: JSON.stringify(category) }, update: { value: JSON.stringify(category) } });
    return NextResponse.json({ category });
  } catch { return error("ذخیره دسته‌بندی انجام نشد.", 500); }
}

export async function PUT(request: Request) {
  const auth = await requirePerm("system.config");
  if (auth.err) return auth.err;
  try {
    const form = await request.formData();
    const rawId = String(form.get("id") || "");
    if (rawId && !validId(rawId)) return error("شناسه مدرک نامعتبر است.");
    const id = rawId || randomUUID();
    const categoryId = String(form.get("categoryId") || "");
    const name = String(form.get("name") || "").trim();
    const code = String(form.get("code") || "").trim();
    const description = String(form.get("description") || "").trim();
    const validUntil = String(form.get("validUntil") || "");
    const reviewAt = String(form.get("reviewAt") || "");
    const active = form.get("active") === "true";
    if (!validId(categoryId) || !name || name.length > 200 || !code || code.length > 100 || description.length > 2000) return error("نام، کد و دسته‌بندی معتبر را وارد کنید.");
    if ((validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) || (reviewAt && !/^\d{4}-\d{2}-\d{2}$/.test(reviewAt))) return error("تاریخ‌ها معتبر نیستند.");
    if (!(await db.setting.findUnique({ where: { key: categoryPrefix + categoryId } }))) return error("دسته‌بندی پیدا نشد.", 404);
    const existing = await db.setting.findUnique({ where: { key: documentPrefix + id } });
    if (rawId && !existing) return error("مدرک پیدا نشد.", 404);
    const old: DocumentItem | undefined = existing ? JSON.parse(existing.value) : undefined;
    const records: { key: string; value: string }[] = [];
    const files: Partial<Pick<DocumentItem, "pdf" | "original">> = { pdf: old?.pdf, original: old?.original };
    const removedFiles: string[] = [];
    for (const kind of ["pdf", "original"] as const) {
      const upload = form.get(kind);
      if (form.get(`remove_${kind}`) === "true" && (!(upload instanceof File) || !upload.size)) { delete files[kind]; removedFiles.push(`${filePrefix}${id}.${kind}`); }
      if (!(upload instanceof File) || !upload.size) continue;
      if (upload.size > 10 * 1024 * 1024) return error("حجم هر فایل باید حداکثر ۱۰ مگابایت باشد.");
      const ext = upload.name.toLowerCase().split(".").pop();
      if (kind === "pdf" ? ext !== "pdf" : !["doc", "docx"].includes(ext || "")) return error(kind === "pdf" ? "فایل PDF معتبر انتخاب کنید." : "فایل اصلی باید Word با پسوند doc یا docx باشد.");
      const buffer = Buffer.from(await upload.arrayBuffer());
      if (kind === "pdf" ? buffer.subarray(0, 5).toString() !== "%PDF-" : ext === "docx" ? buffer.subarray(0, 4).toString("hex") !== "504b0304" : buffer.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1") return error("محتوای فایل با نوع انتخاب‌شده مطابقت ندارد.");
      const filename = upload.name.replace(/[\x00-\x1f\\/]/g, "_").slice(-200);
      files[kind] = { name: filename, size: upload.size };
      records.push({ key: `${filePrefix}${id}.${kind}`, value: buffer.toString("base64") });
    }
    const item: DocumentItem = { id, categoryId, name, code, description, active, updatedAt: new Date().toISOString(), updatedBy: `${auth.user.firstName} ${auth.user.lastName}`.trim(), version: old ? (old.version || 1) + 1 : 1, ...(validUntil ? { validUntil } : {}), ...(reviewAt ? { reviewAt } : {}), ...files };
    records.push({ key: documentPrefix + id, value: JSON.stringify(item) });
    records.push({ key: `${historyPrefix}${id}.${randomUUID()}`, value: JSON.stringify({ version: item.version, updatedAt: item.updatedAt, updatedBy: item.updatedBy, action: old ? "ویرایش" : "ثبت", files: [...records.filter(record => record.key.startsWith(filePrefix)).map(record => record.key.endsWith('.pdf') ? 'PDF' : 'Word'), ...removedFiles.map(key => key.endsWith('.pdf') ? 'حذف PDF' : 'حذف Word')] }) });
    await db.$transaction([...records.map(record => db.setting.upsert({ where: { key: record.key }, create: record, update: { value: record.value } })), ...removedFiles.map(key => db.setting.deleteMany({ where: { key } }))]);
    return NextResponse.json({ item });
  } catch { return error("ذخیره مدرک انجام نشد.", 500); }
}

export async function DELETE(request: Request) {
  const auth = await requirePerm("system.config");
  if (auth.err) return auth.err;
  try {
    const { id, kind } = await request.json();
    if (!validId(id) || !["category", "document"].includes(kind)) return error("درخواست نامعتبر است.");
    if (kind === "category") {
      if ((await readSettings<DocumentItem>(documentPrefix)).some(item => item.categoryId === id)) return error("ابتدا مدارک این دسته را جابه‌جا یا حذف کنید.");
      await db.setting.deleteMany({ where: { key: categoryPrefix + id } });
    } else await db.setting.deleteMany({ where: { OR: [{ key: { in: [documentPrefix + id, `${filePrefix}${id}.pdf`, `${filePrefix}${id}.original`] } }, { key: { startsWith: `${historyPrefix}${id}.` } }] } });
    return NextResponse.json({ ok: true });
  } catch { return error("حذف انجام نشد.", 500); }
}
