import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";
import { custodialWarehouses } from "@/lib/itsm/warehouse-access";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers});
const isId=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=2147483647;

export async function GET() {
  const user=await getItsmIdentity(); if(!user)return fail("ابتدا وارد شوید.",401);
  const manager=user.roles.includes('it_manager'); const ids=manager?[]:await custodialWarehouses(user.employee.id);
  if(!manager&&!ids.length)return fail("دسترسی انبارداری فعال ندارید.",403);
  const [warehouses,transfers]=await Promise.all([
    db.$queryRaw`SELECT w."id",w."name",w."locationId",l."name" AS "locationName",g."name" AS "groupName" FROM "ItsmWarehouse" w JOIN "Location" l ON l."id"=w."locationId" JOIN "ItsmGroup" g ON g."id"=w."groupId" WHERE w."active" AND l."active" AND g."active" AND (${manager} OR w."locationId"=${user.employee.locationId}) ORDER BY l."name",g."name",w."name"`,
    db.$queryRaw`SELECT t."id",t."assetId",t."sourceWarehouseId",t."destinationWarehouseId",t."reason",t."createdAt",a."name" AS "assetName",a."code" AS "assetCode",s."name" AS "sourceName",d."name" AS "destinationName",sl."name" AS "sourceLocation",dl."name" AS "destinationLocation",e."firstName",e."lastName" FROM "ItsmAssetTransfer" t JOIN "ItsmAsset" a ON a."id"=t."assetId" JOIN "ItsmWarehouse" s ON s."id"=t."sourceWarehouseId" JOIN "ItsmWarehouse" d ON d."id"=t."destinationWarehouseId" JOIN "Location" sl ON sl."id"=s."locationId" JOIN "Location" dl ON dl."id"=d."locationId" JOIN "Employee" e ON e."id"=t."requestedById" WHERE t."state"='pending' AND (${manager} OR t."sourceWarehouseId"=ANY(${ids}::int[]) OR t."destinationWarehouseId"=ANY(${ids}::int[])) ORDER BY t."createdAt" DESC`
  ]);
  return NextResponse.json({manager,warehouseIds:ids,warehouses,transfers},{headers});
}

export async function POST(request:Request) {
  const user=await getItsmIdentity(); if(!user)return fail("ابتدا وارد شوید.",401);
  const manager=user.roles.includes('it_manager');
  let d:Record<string,unknown>;try {d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw Error();}catch{return fail("اطلاعات معتبر نیست.");}
  const action=d.action, note=typeof d.note==='string'?d.note.trim():'';
  if(!['request','accept','reject','cancel'].includes(String(action))||!note||note.length>1000)return fail("عملیات و توضیح تا ۱۰۰۰ نویسه الزامی است.");
  if(action==='request'&&(!isId(d.assetId)||!isId(d.destinationWarehouseId)))return fail("دارایی و انبار مقصد معتبر انتخاب کنید.");
  if(action!=='request'&&!isId(d.transferId))return fail("درخواست معتبر نیست.");
  try {
    const result=await db.$transaction(async tx=>{
      if(action==='request') {
        const rows=await tx.$queryRaw<{id:number;status:string;warehouseId:number;locationId:number;name:string;locationName:string}[]>`SELECT a."id",a."status",a."warehouseId",w."locationId",w."name",l."name" AS "locationName" FROM "ItsmAsset" a JOIN "ItsmWarehouse" w ON w."id"=a."warehouseId" JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE a."id"=${d.assetId as number} AND w."active" AND g."active" AND l."active" FOR UPDATE OF a`;
        if(!rows.length)return 'notfound';const asset=rows[0];
        if(!manager) {
          const access=await tx.$queryRaw<{id:number}[]>`SELECT c."id" FROM "ItsmWarehouseCustodian" c JOIN "ItsmWarehouse" w ON w."id"=c."warehouseId" JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "Employee" e ON e."id"=c."employeeId" JOIN "ItsmGroupMembership" m ON m."employeeId"=e."id" AND m."groupId"=w."groupId" JOIN "ItsmRoleGrant" r ON r."employeeId"=e."id" AND r."role" IN ('technician','group_head') WHERE c."warehouseId"=${asset.warehouseId} AND e."id"=${user.employee.id} AND e."active" AND e."locationId"=w."locationId" AND w."active" AND g."active" AND l."active" FOR SHARE OF c,w,g,l,e,m,r`;
          if(!access.length)return 'forbidden';
        }
        const destinations=await tx.$queryRaw<{name:string;locationId:number;locationName:string}[]>`SELECT w."name",w."locationId",l."name" AS "locationName" FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE w."id"=${d.destinationWarehouseId as number} AND w."active" AND g."active" AND l."active" FOR SHARE OF w,g,l`;
        if(!destinations.length||asset.warehouseId===d.destinationWarehouseId||(!manager&&destinations[0].locationId!==asset.locationId))return 'invalid';
        if(asset.status!=='available')return 'conflict';
        const pending=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAssetTransfer" WHERE "assetId"=${asset.id} AND "state"='pending'`;
        if(pending.length)return 'conflict';
        await tx.$executeRaw`INSERT INTO "ItsmAssetTransfer" ("assetId","sourceWarehouseId","destinationWarehouseId","requestedById","reason") VALUES (${asset.id},${asset.warehouseId},${d.destinationWarehouseId as number},${user.employee.id},${note})`;
        const detail=`از ${asset.name} (${asset.locationName}) به ${destinations[0].name} (${destinations[0].locationName}) — ${note}`;
        await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","action","note") VALUES (${asset.id},${user.employee.id},'transfer_requested',${detail})`;
        return 'ok';
      }
      const rows=await tx.$queryRaw<{id:number;assetId:number;sourceWarehouseId:number;destinationWarehouseId:number;state:string;sourceName:string;destinationName:string;sourceLocation:string;destinationLocation:string}[]>`SELECT t."id",t."assetId",t."sourceWarehouseId",t."destinationWarehouseId",t."state",s."name" AS "sourceName",d."name" AS "destinationName",sl."name" AS "sourceLocation",dl."name" AS "destinationLocation" FROM "ItsmAssetTransfer" t JOIN "ItsmWarehouse" s ON s."id"=t."sourceWarehouseId" JOIN "ItsmWarehouse" d ON d."id"=t."destinationWarehouseId" JOIN "Location" sl ON sl."id"=s."locationId" JOIN "Location" dl ON dl."id"=d."locationId" WHERE t."id"=${d.transferId as number} FOR UPDATE OF t`;
      if(!rows.length)return 'notfound';const transfer=rows[0];
      if(transfer.state!=='pending')return 'conflict';
      const required=action==='cancel'?transfer.sourceWarehouseId:transfer.destinationWarehouseId;
      if(!manager){
        const access=await tx.$queryRaw<{id:number}[]>`SELECT c."id" FROM "ItsmWarehouseCustodian" c JOIN "ItsmWarehouse" w ON w."id"=c."warehouseId" JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "Employee" e ON e."id"=c."employeeId" JOIN "ItsmGroupMembership" m ON m."employeeId"=e."id" AND m."groupId"=w."groupId" JOIN "ItsmRoleGrant" r ON r."employeeId"=e."id" AND r."role" IN ('technician','group_head') WHERE c."warehouseId"=${required} AND e."id"=${user.employee.id} AND e."active" AND e."locationId"=w."locationId" AND w."active" AND g."active" AND l."active" FOR SHARE OF c,w,g,l,e,m,r`;
        if(!access.length)return 'forbidden';
      }
      const assets=await tx.$queryRaw<{warehouseId:number;status:string}[]>`SELECT "warehouseId","status" FROM "ItsmAsset" WHERE "id"=${transfer.assetId} FOR UPDATE`;
      if(!assets.length||assets[0].warehouseId!==transfer.sourceWarehouseId||assets[0].status!=='available')return 'conflict';
      if(action==='accept') {
        const dest=await tx.$queryRaw<{id:number}[]>`SELECT w."id" FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE w."id"=${transfer.destinationWarehouseId} AND w."active" AND g."active" AND l."active" FOR SHARE OF w,g,l`;
        if(!dest.length)return 'conflict';
        await tx.$executeRaw`UPDATE "ItsmAsset" SET "warehouseId"=${transfer.destinationWarehouseId},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${transfer.assetId}`;
      }
      const state=action==='accept'?'accepted':action==='reject'?'rejected':'cancelled';
      await tx.$executeRaw`UPDATE "ItsmAssetTransfer" SET "state"=${state},"decidedById"=${user.employee.id},"decisionNote"=${note},"decidedAt"=CURRENT_TIMESTAMP WHERE "id"=${transfer.id}`;
      const detail=`از ${transfer.sourceName} (${transfer.sourceLocation}) به ${transfer.destinationName} (${transfer.destinationLocation}) — ${note}`;
      await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","action","note") VALUES (${transfer.assetId},${user.employee.id},${'transfer_'+state},${detail})`;
      return 'ok';
    });
    if(result==='forbidden')return fail("دسترسی این عملیات را ندارید.",403);
    if(result==='notfound')return fail("درخواست یا دارایی پیدا نشد.",404);
    if(result==='invalid')return fail("انبار مقصد معتبر یا مجاز نیست.");
    if(result!=='ok')return fail("وضعیت دارایی یا درخواست تغییر کرده است.",409);
    return NextResponse.json({ok:true},{headers});
  }catch(error){console.error('ITSM asset transfer failed',error);return fail("ثبت عملیات ممکن نشد.",500);}
}
