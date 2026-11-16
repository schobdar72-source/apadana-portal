import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { startSla, txNow } from "@/lib/itsm/sla-runtime";
import { transferIndicator } from "@/lib/itsm/transfer-indicator";
import { latestSlaJoin, latestSlaSelect, withSlaBadge } from "@/lib/itsm/sla-list";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  const all = new URL(request.url).searchParams.get("view") === "all";
  if (all) {
    const managers = await db.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmRoleGrant" WHERE "employeeId" = ${auth.user.id} AND "role" = 'it_manager'`;
    if (!managers.length) return NextResponse.json({ error: "دسترسی به همه تیکت‌ها مجاز نیست." }, { status: 403, headers });
  }
  const tickets = await db.$queryRaw`
    SELECT t."id", t."title", t."status", t."createdAt", c."name" AS "category", g."name" AS "group", transfer_info."sourceGroup" AS "transferSource", transfer_info."senderName" AS "transferSender", COALESCE(t."assigneeId" = ${auth.user.id} AND (SELECT e."action" = 'assigned' AND e."actorId" <> ${auth.user.id} FROM "ItsmTicketEvent" e WHERE e."ticketId" = t."id" AND e."action" IN ('assigned', 'claimed', 'transferred') ORDER BY e."id" DESC LIMIT 1), false) AS "assignedBySupervisor", ${latestSlaSelect}
    FROM "ItsmTicket" t JOIN "ItsmCategory" c ON c."id" = t."categoryId"
    JOIN "ItsmGroup" g ON g."id" = t."groupId"
    ${transferIndicator(Prisma.sql`t."assigneeId" = ${auth.user.id}`)}
    ${latestSlaJoin}
    WHERE ${all} OR t."requesterId" = ${auth.user.id} OR t."beneficiaryId" = ${auth.user.id} OR t."assigneeId" = ${auth.user.id}
    ORDER BY t."createdAt" DESC, t."id" DESC LIMIT 100
  `;
  const now = new Date();
  return NextResponse.json((tickets as Parameters<typeof withSlaBadge>[0][]).map((row) => withSlaBadge(row, now)), { headers });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.err) return auth.err;
  let body: unknown;
  let attachment: File | null = null;
  try {
    if (request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
      if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024) return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است." }, { status: 413, headers });
      const form = await request.formData();
      const item = form.get("file");
      if (item !== null) {
        if (!(item instanceof File)) return NextResponse.json({ error: "فایل معتبر نیست." }, { status: 400, headers });
        attachment = item;
      }
      const category = form.get("categoryId");
      const beneficiary = form.get("beneficiaryId");
      const asset = form.get("assetId");
      const personalAsset = form.get("personalAssetId");
      body = { title: form.get("title"), description: form.get("description"), contactExtension: form.get("contactExtension"), kind: form.get("kind") ?? "incident", categoryId: typeof category === "string" && /^\d+$/.test(category) ? Number(category) : null, ...(typeof beneficiary === "string" && /^\d+$/.test(beneficiary) ? { beneficiaryId: Number(beneficiary) } : beneficiary !== null ? { beneficiaryId: null } : {}), ...(typeof asset === "string" && /^\d+$/.test(asset) ? { assetId: Number(asset) } : asset !== null ? { assetId: "invalid" } : {}), ...(typeof personalAsset === "string" && /^\d+$/.test(personalAsset) ? { personalAssetId: Number(personalAsset) } : personalAsset !== null ? { personalAssetId: "invalid" } : {}) };
    } else body = await request.json();
  } catch { return NextResponse.json({ error: "اطلاعات درخواست معتبر نیست." }, { status: 400, headers }); }
  if (attachment && (attachment.size < 1 || attachment.size > 5 * 1024 * 1024 || !/\.(pdf|png|jpe?g|docx|xlsx)$/i.test(attachment.name))) return NextResponse.json({ error: "فایل PDF، تصویر، Word یا Excel با حداکثر حجم ۵ مگابایت انتخاب کنید." }, { status: 400, headers });
  const fileData = attachment ? { name: attachment.name.replace(/[\u0000-\u001f/\\]/g, "_").slice(-150), size: attachment.size, content: Buffer.from(await attachment.arrayBuffer()) } : null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "اطلاعات درخواست معتبر نیست." }, { status: 400, headers });
  const data = body as Record<string, unknown>;
  const kind = data.kind === undefined ? "incident" : data.kind;
  if (kind !== "incident" && kind !== "service") return NextResponse.json({ error: "نوع درخواست معتبر نیست." }, { status: 400, headers });
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const extension = typeof data.contactExtension === "string" ? data.contactExtension.trim().replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 1776 ? 1776 : 1632))) : "";
  const categoryId = data.categoryId;
  const assetId = data.assetId === undefined ? null : data.assetId;
  const personalAssetId = data.personalAssetId === undefined ? null : data.personalAssetId;
  if ((assetId !== null && personalAssetId !== null) || (personalAssetId !== null && (typeof personalAssetId !== "number" || !Number.isSafeInteger(personalAssetId) || personalAssetId < 1 || personalAssetId > 2147483647))) return NextResponse.json({ error: "دارایی انتخاب‌شده معتبر نیست." }, { status: 400, headers });
  if (assetId !== null && (typeof assetId !== "number" || !Number.isSafeInteger(assetId) || assetId < 1 || assetId > 2147483647)) return NextResponse.json({ error: "دارایی انتخاب‌شده معتبر نیست." }, { status: 400, headers });
  if (!/^[0-9]{1,10}$/.test(extension)) return NextResponse.json({ error: "شماره داخلی معتبر را با حداکثر ۱۰ رقم وارد کنید." }, { status: 400, headers });
  if (title.length < 3 || title.length > 200 || description.length < 3 || description.length > 10000 || typeof categoryId !== "number" || !Number.isSafeInteger(categoryId) || categoryId < 1 || categoryId > 2147483647) return NextResponse.json({ error: "عنوان، شرح و دسته‌بندی معتبر را وارد کنید." }, { status: 400, headers });
  if (!auth.user.locationId) return NextResponse.json({ error: "محل خدمت شما مشخص نیست؛ با مدیر سیستم تماس بگیرید." }, { status: 400, headers });
  let beneficiaryId = auth.user.id;
  if (data.beneficiaryId !== undefined && data.beneficiaryId !== auth.user.id) {
    if (typeof data.beneficiaryId !== "number" || !Number.isSafeInteger(data.beneficiaryId) || data.beneficiaryId < 1 || data.beneficiaryId > 2147483647) return NextResponse.json({ error: "همکار انتخاب‌شده معتبر نیست." }, { status: 400, headers });
    const beneficiary = await db.employee.findFirst({ where: { id: data.beneficiaryId, active: true, locationId: auth.user.locationId }, select: { id: true } });
    if (!beneficiary) return NextResponse.json({ error: "همکار فعال در محل خدمت شما پیدا نشد." }, { status: 400, headers });
    beneficiaryId = beneficiary.id;
  }
  const ticket = await db.$transaction(async (transaction) => {
    if (assetId === null && personalAssetId === null) {
      const assets = await transaction.$queryRaw<{ id: number }[]>`SELECT a."id" FROM "ItsmAsset" a JOIN "ItsmWarehouse" w ON w."id" = a."warehouseId" WHERE a."assignedToId" = ${beneficiaryId} AND a."status" = 'assigned' AND w."locationId" = ${auth.user.locationId} LIMIT 1`;
      const personal = await transaction.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmPersonalAsset" WHERE "employeeId"=${beneficiaryId} AND "locationId"=${auth.user.locationId} AND "active" LIMIT 1`;
      if (assets.length || personal.length) return { error: "برای این فرد دارایی ثبت شده است؛ دارایی مرتبط را انتخاب کنید." };
    }
    if (personalAssetId !== null) {
      const personal = await transaction.$queryRaw<{ id: number }[]>`SELECT "id" FROM "ItsmPersonalAsset" WHERE "id"=${personalAssetId} AND "employeeId"=${beneficiaryId} AND "locationId"=${auth.user.locationId} AND "active" FOR SHARE`;
      if (!personal.length) return { error: "دارایی انتخاب‌شده به این فرد تعلق ندارد یا دیگر در دسترس نیست." };
    }
    if (assetId !== null) {
      const assets = await transaction.$queryRaw<{ id: number }[]>`SELECT a."id" FROM "ItsmAsset" a JOIN "ItsmWarehouse" w ON w."id" = a."warehouseId" WHERE a."id" = ${assetId} AND a."assignedToId" = ${beneficiaryId} AND a."status" = 'assigned' AND w."locationId" = ${auth.user.locationId} FOR SHARE OF a`;
      if (!assets.length) return { error: "دارایی انتخاب‌شده به این فرد تحویل نشده است یا دیگر در دسترس نیست." };
    }
    const rows = await transaction.$queryRaw<{ id: number }[]>`
      INSERT INTO "ItsmTicket" ("title", "description", "contactExtension", "categoryId", "groupId", "requesterId", "beneficiaryId", "locationId", "assetId", "personalAssetId", "kind", "updatedAt")
      SELECT ${title}, ${description}, ${extension}, c."id", g."id", ${auth.user.id}, ${beneficiaryId}, ${auth.user.locationId}, ${assetId}, ${personalAssetId}, ${kind}, CURRENT_TIMESTAMP
      FROM "ItsmCategory" c JOIN "ItsmGroup" g ON g."id" = c."groupId"
      WHERE c."id" = ${categoryId} AND c."active" = true AND g."active" = true
      FOR UPDATE OF c, g RETURNING "id"
    `;
    if (!rows.length) return null;
    await startSla(transaction,rows[0].id,auth.user.id,await txNow(transaction));
    await transaction.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${rows[0].id}, ${auth.user.id}, 'created')`;
    if (fileData) {
      await transaction.$executeRaw`INSERT INTO "ItsmAttachment" ("ticketId", "uploaderId", "filename", "size", "content") VALUES (${rows[0].id}, ${auth.user.id}, ${fileData.name}, ${fileData.size}, ${fileData.content})`;
      await transaction.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId", "actorId", "action") VALUES (${rows[0].id}, ${auth.user.id}, 'attachment_added')`;
    }
    return rows[0];
  });
  if (!ticket) return NextResponse.json({ error: "دسته‌بندی یا واحد رسیدگی فعال نیست." }, { status: 400, headers });
  if ("error" in ticket) return NextResponse.json({ error: ticket.error }, { status: 400, headers });
  return NextResponse.json(ticket, { status: 201, headers });
}
