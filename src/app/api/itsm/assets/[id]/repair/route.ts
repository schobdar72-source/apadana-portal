import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers});
export async function POST(request:Request,{params}:{params:{id:string}}) {
  const user=await getItsmIdentity();
  if(!user)return fail("ابتدا وارد شوید.",401);
  const assetId=Number(params.id);
  if(!/^\d+$/.test(params.id)||!Number.isSafeInteger(assetId)||assetId<1||assetId>2147483647)return fail("دارایی معتبر نیست.");
  let data:Record<string,unknown>;
  try { data=await request.json(); if(!data||typeof data!=="object"||Array.isArray(data))throw Error(); } catch{return fail("اطلاعات معتبر نیست.");}
  const action=typeof data.action==="string"?data.action:"";
  const note=typeof data.note==="string"?data.note.trim():"";
  if(!["fault","repair","quarantine","result","approve","reject"].includes(action)||!note||note.length>2000)return fail("عملیات و توضیح معتبر تا ۲۰۰۰ نویسه وارد کنید.");
  if(action==="result" && data.outcome!=="available" && data.outcome!=="scrapped")return fail("نتیجه پیشنهادی معتبر نیست.");
  if(action==="result" && data.ticketId!=null && (!Number.isSafeInteger(data.ticketId)||(data.ticketId as number)<1||(data.ticketId as number)>2147483647))return fail("شماره تیکت معتبر نیست.");
  if((action==="approve"||action==="reject")&&(!Number.isSafeInteger(data.repairId)||(data.repairId as number)<1||(data.repairId as number)>2147483647))return fail("گزارش معتبر نیست.");
  const manager=user.roles.includes("it_manager");
  try {
    const result=await db.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{id:number;status:string;warehouseId:number}[]>`SELECT "id","status","warehouseId" FROM "ItsmAsset" WHERE "id"=${assetId} FOR UPDATE`;
      if(!rows.length)return "notfound";
      const asset=rows[0];
      const transfers=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAssetTransfer" WHERE "assetId"=${assetId} AND "state"='pending'`;
      if(transfers.length)return "conflict";
      const access=await tx.$queryRaw<{isHead:boolean;isCustodian:boolean}[]>`SELECT EXISTS (SELECT 1 FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "Employee" e ON e."id"=${user.employee.id} JOIN "ItsmGroupMembership" m ON m."groupId"=w."groupId" AND m."employeeId"=e."id" JOIN "ItsmRoleGrant" r ON r."employeeId"=e."id" AND r."role"='group_head' WHERE w."id"=${asset.warehouseId} AND w."active" AND g."active" AND l."active" AND e."active" AND e."locationId"=w."locationId") AS "isHead", EXISTS (SELECT 1 FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "Employee" e ON e."id"=${user.employee.id} JOIN "ItsmWarehouseCustodian" c ON c."warehouseId"=w."id" AND c."employeeId"=e."id" JOIN "ItsmGroupMembership" m ON m."groupId"=w."groupId" AND m."employeeId"=e."id" JOIN "ItsmRoleGrant" r ON r."employeeId"=e."id" AND r."role" IN ('technician','group_head') WHERE w."id"=${asset.warehouseId} AND w."active" AND g."active" AND l."active" AND e."active" AND e."locationId"=w."locationId") AS "isCustodian"`;
      const {isHead,isCustodian}=access[0];
      if(action==="approve"||action==="reject") {
        if(!isHead)return "forbidden";
        const repairId=data.repairId as number;
        const reports=await tx.$queryRaw<{outcome:string}[]>`UPDATE "ItsmAssetRepair" SET "state"=${action==='approve'?'approved':'rejected'},"decidedById"=${user.employee.id},"decisionNote"=${note},"decidedAt"=CURRENT_TIMESTAMP WHERE "id"=${repairId} AND "assetId"=${assetId} AND "state"='pending' RETURNING "outcome"`;
        if(!reports.length)return "conflict";
        if(action==="approve")await tx.$executeRaw`UPDATE "ItsmAsset" SET "status"=${reports[0].outcome},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${assetId}`;
        const decisionDetail=`${action==='approve'?(reports[0].outcome==='available'?'تأیید بازگشت به انبار':'تأیید اسقاط'):'رد نتیجه'} — ${note}`;
        await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","action","note") VALUES (${assetId},${user.employee.id},${action==='approve'?'repair_approved':'repair_rejected'},${decisionDetail})`;
        return "ok";
      }
      if(!manager&&!isCustodian&&!isHead)return "forbidden";
      const pending=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAssetRepair" WHERE "assetId"=${assetId} AND "state"='pending'`;
      if(pending.length)return "conflict";
      if(action==='result') {
        if(!['broken','repair','quarantine'].includes(asset.status))return "conflict";
        const ticketId=data.ticketId==null?null:data.ticketId as number;
        if(ticketId!==null){const tickets=await tx.$queryRaw<{id:number}[]>`SELECT t."id" FROM "ItsmTicket" t JOIN "ItsmWarehouse" w ON w."id"=${asset.warehouseId} WHERE t."id"=${ticketId} AND t."groupId"=w."groupId" AND t."locationId"=w."locationId" FOR SHARE OF t`;if(!tickets.length)return "ticket";}
        await tx.$executeRaw`INSERT INTO "ItsmAssetRepair" ("assetId","reportedById","report","outcome","ticketId") VALUES (${assetId},${user.employee.id},${note},${data.outcome as string},${ticketId})`;
        const resultDetail=`${note} — پیشنهاد: ${data.outcome==='available'?'بازگشت به انبار':'اسقاط'}${ticketId===null?'':` — تیکت شماره ${ticketId}`}`;
        await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","action","note") VALUES (${assetId},${user.employee.id},'repair_result',${resultDetail})`;
        return "ok";
      }
      const allowed:Record<string,string[]>={fault:['available'],repair:['broken','quarantine'],quarantine:['broken','repair']};
      const target:Record<string,string>={fault:'broken',repair:'repair',quarantine:'quarantine'};
      if(!allowed[action]?.includes(asset.status))return "conflict";
      await tx.$executeRaw`UPDATE "ItsmAsset" SET "status"=${target[action]},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${assetId}`;
      await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","action","note") VALUES (${assetId},${user.employee.id},${'asset_'+target[action]},${note})`;
      return "ok";
    });
    if(result==='forbidden')return fail("دسترسی این عملیات را ندارید.",403);
    if(result==='notfound')return fail("دارایی پیدا نشد.",404);
    if(result==='ticket')return fail("تیکت در واحد و محل خدمت این انبار پیدا نشد.");
    if(result!=='ok')return fail("وضعیت دارایی تغییر کرده یا گزارش در انتظار تصمیم است.",409);
    return NextResponse.json({ok:true},{headers});
  } catch(error){console.error("ITSM repair failed",error);return fail("ثبت عملیات انجام نشد.",500);}
}
