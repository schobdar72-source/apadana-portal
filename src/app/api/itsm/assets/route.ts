import { NextResponse } from "next/server";
import { getItsmIdentity } from "@/lib/itsm/access";
import { db } from "@/lib/db";
import { custodialWarehouses, headedWarehouses } from "@/lib/itsm/warehouse-access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });
const text = (value: unknown, max = 120) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";
const id = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

export async function GET() {
  const identity = await getItsmIdentity();
  if (!identity) return fail("ابتدا وارد شوید.", 401);
  const manager = identity.roles.includes("it_manager");
  const warehouseIds=manager?[]:await custodialWarehouses(identity.employee.id);
  const headWarehouseIds=await headedWarehouses(identity.employee.id);
  const visibleIds=Array.from(new Set([...warehouseIds,...headWarehouseIds]));
  const assets = await db.$queryRaw`SELECT a."id", a."name", a."code", a."serial", a."brand", a."model", a."status", a."assignedToId", a."warehouseId", EXISTS (SELECT 1 FROM "ItsmAssetTransfer" t WHERE t."assetId"=a."id" AND t."state"='pending') AS "transferPending", c."name" AS "category", w."name" AS "warehouse", l."name" AS "location", e."firstName", e."lastName" FROM "ItsmAsset" a JOIN "ItsmAssetCategory" c ON c."id"=a."categoryId" JOIN "ItsmWarehouse" w ON w."id"=a."warehouseId" JOIN "Location" l ON l."id"=w."locationId" LEFT JOIN "Employee" e ON e."id"=a."assignedToId" WHERE ${manager} OR a."assignedToId"=${identity.employee.id} OR a."warehouseId"=ANY(${visibleIds}::int[]) ORDER BY a."id" DESC`;
  if (!manager && !visibleIds.length) return NextResponse.json({ manager, assets, warehouseIds, headWarehouseIds }, { headers });
  const [categories, warehouses, groups, locations, employees, custodians] = await Promise.all([
    db.$queryRaw`SELECT "id", "name", "parentId" FROM "ItsmAssetCategory" WHERE "active"=true ORDER BY "name"`,
    db.$queryRaw`SELECT w."id", w."name", w."groupId", w."locationId", g."name" AS "groupName", l."name" AS "locationName" FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE w."active"=true AND (${manager} OR w."id"=ANY(${visibleIds}::int[])) ORDER BY w."name"`,
    manager?db.$queryRaw`SELECT "id", "name" FROM "ItsmGroup" WHERE "active"=true ORDER BY "name"`:Promise.resolve([]),
    manager?db.$queryRaw`SELECT "id", "name" FROM "Location" WHERE "active"=true ORDER BY "name"`:Promise.resolve([]),
    db.$queryRaw`SELECT e."id", e."firstName", e."lastName", e."code", e."locationId" FROM "Employee" e WHERE e."active"=true AND (${manager} OR e."locationId" IN (SELECT "locationId" FROM "ItsmWarehouse" WHERE "id"=ANY(${visibleIds}::int[]))) ORDER BY e."lastName", e."firstName"`,
    manager?db.$queryRaw`SELECT c."warehouseId",c."employeeId",e."firstName",e."lastName",e."code" FROM "ItsmWarehouseCustodian" c JOIN "Employee" e ON e."id"=c."employeeId" ORDER BY e."lastName",e."firstName"`:Promise.resolve([]),
  ]);
  const repairs=await db.$queryRaw`SELECT r."id",r."assetId",r."report",r."outcome",r."state",r."createdAt",r."ticketId", e."firstName",e."lastName" FROM "ItsmAssetRepair" r JOIN "ItsmAsset" a ON a."id"=r."assetId" JOIN "Employee" e ON e."id"=r."reportedById" WHERE r."state"='pending' AND (${manager} OR a."warehouseId"=ANY(${visibleIds}::int[])) ORDER BY r."createdAt"`;
  return NextResponse.json({ manager, warehouseIds, headWarehouseIds, assets, categories, warehouses, groups, locations, employees, custodians, repairs }, { headers });
}

export async function POST(request: Request) {
  const identity = await getItsmIdentity();
  if (!identity) return fail("ابتدا وارد شوید.", 401);
  let d: Record<string, unknown>;
  try { d = await request.json(); if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error(); } catch { return fail("اطلاعات معتبر نیست."); }
  const manager=identity.roles.includes("it_manager");
  if(!manager && !["asset", "assign", "return"].includes(String(d.action))) return fail("دسترسی مدیریت دارایی ندارید.",403);
  try {
    if (d.action === "category") {
      const name = text(d.name); const parentId = d.parentId == null ? null : d.parentId;
      if (!name || (parentId !== null && !id(parentId))) return fail("نام و دسته والد معتبر وارد کنید.");
      if (parentId !== null && !(await db.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAssetCategory" WHERE "id"=${parentId} AND "active"=true`).length) return fail("دسته والد فعال نیست.");
      const result = await db.$transaction(async tx => { const rows = await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmAssetCategory" ("name", "parentId") VALUES (${name}, ${parentId}) RETURNING "id"`; await tx.$executeRaw`INSERT INTO "ItsmAuditEvent" ("actorId", "action", "targetType", "targetId", "details") VALUES (${identity.employee.id}, 'created', 'asset_category', ${rows[0].id}, '{}'::jsonb)`; return rows[0]; });
      return NextResponse.json(result, { status: 201, headers });
    }
    if (d.action === "warehouse") {
      const name = text(d.name); const groupId = d.groupId; const locationId = d.locationId;
      if (!name || !id(groupId) || !id(locationId)) return fail("نام، واحد و محل خدمت را مشخص کنید.");
      const result = await db.$transaction(async tx => { const rows = await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmWarehouse" ("name", "groupId", "locationId") SELECT ${name}, g."id", l."id" FROM "ItsmGroup" g CROSS JOIN "Location" l WHERE g."id"=${groupId} AND g."active"=true AND l."id"=${locationId} AND l."active"=true RETURNING "id"`; if (!rows.length) return null; await tx.$executeRaw`INSERT INTO "ItsmAuditEvent" ("actorId", "action", "targetType", "targetId", "details") VALUES (${identity.employee.id}, 'created', 'warehouse', ${rows[0].id}, '{}'::jsonb)`; return rows[0]; });
      return result ? NextResponse.json(result, { status: 201, headers }) : fail("واحد یا محل خدمت فعال نیست.");
    }
    if (d.action === "asset") {
      const name=text(d.name), code=text(d.code,80), serial=text(d.serial), brand=text(d.brand), model=text(d.model), categoryId=d.categoryId, warehouseId=d.warehouseId;
      if (!name || !code || !id(categoryId) || !id(warehouseId)) return fail("نام، کد، دسته و انبار را مشخص کنید.");
      const permittedWarehouses = manager ? [] : await headedWarehouses(identity.employee.id);
      if (!manager && !permittedWarehouses.includes(warehouseId)) return fail("فقط می‌توانید برای انبار واحد خود دارایی ثبت کنید.", 403);
      const result = await db.$transaction(async tx => { const rows = await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmAsset" ("name","code","serial","brand","model","categoryId","warehouseId") SELECT ${name},${code},${serial},${brand},${model},c."id",w."id" FROM "ItsmAssetCategory" c CROSS JOIN "ItsmWarehouse" w WHERE c."id"=${categoryId} AND c."active"=true AND w."id"=${warehouseId} AND w."active"=true RETURNING "id"`; if (!rows.length) return null; await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","action") VALUES (${rows[0].id},${identity.employee.id},'created')`; return rows[0]; });
      return result ? NextResponse.json(result, { status: 201, headers }) : fail("دسته یا انبار فعال نیست.");
    }
    if (d.action === "assign" || d.action === "return") {
      const assetId=d.assetId, recipientId=d.recipientId, note=text(d.note,1000);
      if (!id(assetId) || (d.action === "assign" && !id(recipientId)) || (d.action === "return" && !note)) return fail("اطلاعات تحویل یا وضعیت ظاهری و فنی عودت را کامل کنید.");
      const returnStatus=d.returnStatus;
      if(d.action==='return' && returnStatus!=='available' && returnStatus!=='broken') return fail("وضعیت عودت معتبر نیست.");
      if(!manager && !(await custodialWarehouses(identity.employee.id)).length) return fail("دسترسی انبارداری فعال ندارید.",403);
      const result = await db.$transaction(async tx => {
        if(!manager) {
          const permitted=await tx.$queryRaw<{id:number}[]>`SELECT c."id" FROM "ItsmAsset" a JOIN "ItsmWarehouse" w ON w."id"=a."warehouseId" JOIN "ItsmWarehouseCustodian" c ON c."warehouseId"=w."id" AND c."employeeId"=${identity.employee.id} JOIN "Employee" e ON e."id"=c."employeeId" JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "ItsmGroupMembership" m ON m."groupId"=w."groupId" AND m."employeeId"=e."id" WHERE a."id"=${assetId} AND w."active"=true AND e."active"=true AND e."locationId"=w."locationId" AND g."active"=true AND l."active"=true AND EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId"=e."id" AND r."role" IN ('technician','group_head')) FOR SHARE OF c,m,w,e,g,l`;
          if(!permitted.length)return false;
        }
        if (d.action === "assign" && id(recipientId)) {
          const locked=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAsset" WHERE "id"=${assetId} FOR UPDATE`;
          if(!locked.length)return false;
          const moving=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAssetTransfer" WHERE "assetId"=${assetId} AND "state"='pending'`;
          if(moving.length)return false;
          const rows = await tx.$queryRaw<{id:number}[]>`UPDATE "ItsmAsset" a SET "status"='assigned', "assignedToId"=e."id", "updatedAt"=CURRENT_TIMESTAMP FROM "ItsmWarehouse" w, "Employee" e WHERE a."id"=${assetId} AND a."warehouseId"=w."id" AND w."active"=true AND a."status"='available' AND e."id"=${recipientId} AND e."active"=true AND e."locationId"=w."locationId" RETURNING a."id"`;
          if (!rows.length) return false;
          await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","recipientId","action","note") VALUES (${assetId},${identity.employee.id},${recipientId},'assigned',${note})`; return true;
        }
        const rows = await tx.$queryRaw<{assignedToId:number}[]>`SELECT "assignedToId" FROM "ItsmAsset" WHERE "id"=${assetId} AND "status"='assigned' FOR UPDATE`;
        if (!rows.length) return false;
        await tx.$executeRaw`UPDATE "ItsmAsset" SET "status"=${returnStatus as string}, "assignedToId"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${assetId}`;
        const returnNote=returnStatus==='broken'?`عودت با وضعیت خراب — ${note}`:note;
        await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","recipientId","action","note") VALUES (${assetId},${identity.employee.id},${rows[0].assignedToId},'returned',${returnNote})`; return true;
      });
      return result ? NextResponse.json({ ok:true }, { headers }) : fail("دارایی در وضعیت مناسب نیست یا همکار در محل انبار فعال نیست.", 409);
    }
    return fail("عملیات ناشناخته است.");
  } catch (error) { console.error("ITSM asset operation failed", error); return fail("ثبت ممکن نشد؛ از تکراری نبودن کد یا انبار همان واحد و محل مطمئن شوید.", 409); }
}
