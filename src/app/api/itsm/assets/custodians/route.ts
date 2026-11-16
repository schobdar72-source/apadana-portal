import { NextResponse } from "next/server";
import { getItsmIdentity } from "@/lib/itsm/access";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error:string,status=400)=>NextResponse.json({error},{status,headers});
export async function POST(request:Request) {
  const user=await getItsmIdentity();
  if (!user) return fail("ابتدا وارد شوید.",401);
  if (!user.roles.includes("it_manager")) return fail("فقط مدیر فناوری اطلاعات می‌تواند انباردار تعیین کند.",403);
  let data:Record<string,unknown>;
  try { data=await request.json(); if(!data || typeof data!=="object" || Array.isArray(data)) throw new Error(); } catch {return fail("اطلاعات معتبر نیست.");}
  const {warehouseId,employeeId,action}=data;
  if(!Number.isSafeInteger(warehouseId)||!Number.isSafeInteger(employeeId)||(warehouseId as number)<1||(employeeId as number)<1||(warehouseId as number)>2147483647||(employeeId as number)>2147483647||!["add","remove"].includes(String(action))) return fail("انبار و همکار معتبر انتخاب کنید.");
  const wid=warehouseId as number, eid=employeeId as number;
  const result=await db.$transaction(async tx=>{
    if(action==="add") {
      const rows=await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmWarehouseCustodian" ("warehouseId","employeeId") SELECT w."id",e."id" FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "Employee" e ON e."id"=${eid} WHERE w."id"=${wid} AND w."active"=true AND g."active"=true AND l."active"=true AND e."active"=true AND e."locationId"=w."locationId" AND EXISTS (SELECT 1 FROM "ItsmGroupMembership" m WHERE m."groupId"=w."groupId" AND m."employeeId"=e."id") AND EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId"=e."id" AND r."role" IN ('technician','group_head')) ON CONFLICT ("warehouseId","employeeId") DO NOTHING RETURNING "id"`;
      if(!rows.length)return false;
    } else {
      const rows=await tx.$queryRaw<{id:number}[]>`DELETE FROM "ItsmWarehouseCustodian" WHERE "warehouseId"=${wid} AND "employeeId"=${eid} RETURNING "id"`;
      if(!rows.length)return false;
    }
    await tx.$executeRaw`INSERT INTO "ItsmAuditEvent" ("actorId","action","targetType","targetId","details") VALUES (${user.employee.id}, ${action==='add'?'custodian_added':'custodian_removed'}, 'warehouse', ${wid}, jsonb_build_object('employeeId',${eid}::int))`;
    return true;
  });
  return result?NextResponse.json({ok:true},{headers}):fail(action==='add'?'همکار باید فعال، عضو واحد انبار، کارشناس یا رئیس و در همان محل خدمت باشد؛ دسترسی تکراری نیز ثبت نمی‌شود.':'این دسترسی پیدا نشد.',409);
}
