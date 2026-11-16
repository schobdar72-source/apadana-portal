import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";
import { custodialWarehouses, headedWarehouses } from "@/lib/itsm/warehouse-access";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(_request:Request,{params}:{params:{id:string}}) {
  const user=await getItsmIdentity();
  if(!user)return NextResponse.json({error:"ابتدا وارد شوید."},{status:401,headers});
  const id=Number(params.id);
  if(!/^\d+$/.test(params.id)||!Number.isSafeInteger(id)||id<1||id>2147483647)return NextResponse.json({error:"دارایی پیدا نشد."},{status:404,headers});
  const manager=user.roles.includes("it_manager"), warehouses=manager?[]:[...await custodialWarehouses(user.employee.id),...await headedWarehouses(user.employee.id)];
  const allowed=await db.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAsset" WHERE "id"=${id} AND (${manager} OR "warehouseId"=ANY(${warehouses}::int[]))`;
  if(!allowed.length)return NextResponse.json({error:"دارایی پیدا نشد."},{status:404,headers});
  const events=await db.$queryRaw`SELECT ev."id",ev."action",ev."note",ev."createdAt",actor."firstName" AS "actorFirstName",actor."lastName" AS "actorLastName",recipient."firstName" AS "recipientFirstName",recipient."lastName" AS "recipientLastName" FROM "ItsmAssetEvent" ev JOIN "Employee" actor ON actor."id"=ev."actorId" LEFT JOIN "Employee" recipient ON recipient."id"=ev."recipientId" WHERE ev."assetId"=${id} ORDER BY ev."createdAt" DESC,ev."id" DESC`;
  return NextResponse.json(events,{headers});
}
