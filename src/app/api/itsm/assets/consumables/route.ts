import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";
import { custodialWarehouses, headedWarehouses } from "@/lib/itsm/warehouse-access";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers});
const id=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';

export async function GET(request:Request) {
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 const manager=user.roles.includes('it_manager'),ids=manager?[]:Array.from(new Set([...await custodialWarehouses(user.employee.id), ...await headedWarehouses(user.employee.id)]));
 if(!manager&&!ids.length)return fail("دسترسی انبارداری فعال ندارید.",403);
 const raw=new URL(request.url).searchParams.get('itemId');
 if(raw!==null){const itemId=Number(raw);if(!/^\d+$/.test(raw)||!id(itemId))return fail("قلم معتبر نیست.");
  const allowed=await db.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmConsumable" WHERE "id"=${itemId} AND (${manager} OR "warehouseId"=ANY(${ids}::int[]))`;
  if(!allowed.length)return fail("قلم پیدا نشد.",404);
  const events=await db.$queryRaw`SELECT ev."id",ev."action",ev."quantity",ev."balance",ev."note",ev."createdAt",a."firstName" AS "actorFirstName",a."lastName" AS "actorLastName",r."firstName" AS "recipientFirstName",r."lastName" AS "recipientLastName" FROM "ItsmConsumableEvent" ev JOIN "Employee" a ON a."id"=ev."actorId" LEFT JOIN "Employee" r ON r."id"=ev."recipientId" WHERE ev."itemId"=${itemId} ORDER BY ev."createdAt" DESC,ev."id" DESC LIMIT 200`;
  return NextResponse.json(events,{headers});
 }
 const items=await db.$queryRaw`SELECT c."id",c."warehouseId",c."name",c."code",c."unit",c."quantity",c."minimum",w."name" AS "warehouse",l."name" AS "location" FROM "ItsmConsumable" c JOIN "ItsmWarehouse" w ON w."id"=c."warehouseId" JOIN "Location" l ON l."id"=w."locationId" WHERE ${manager} OR c."warehouseId"=ANY(${ids}::int[]) ORDER BY c."name",c."id"`;
 return NextResponse.json({manager,items},{headers});
}

export async function POST(request:Request) {
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 const manager=user.roles.includes('it_manager');let d:Record<string,unknown>;
 const headIds = manager ? [] : await headedWarehouses(user.employee.id);
 try{d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw Error();}catch{return fail("اطلاعات معتبر نیست.");}
 if(d.action==='create'){
  const name=text(d.name,120),code=text(d.code,80),unit=text(d.unit,30),warehouseId=d.warehouseId,minimum=d.minimum;
  if(!name||!code||!unit||!id(warehouseId)||!integer(minimum))return fail("نام، کد یکتا، واحد شمارش، حداقل و انبار معتبر لازم است.");
  if (!manager && !headIds.includes(warehouseId)) return fail("فقط رئیس واحد می‌تواند برای انبار واحد خود قلم تعریف کند.",403);
  try{const item=await db.$transaction(async tx=>{const rows=await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmConsumable" ("warehouseId","name","code","unit","minimum") SELECT w."id",${name},${code},${unit},${minimum} FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE w."id"=${warehouseId} AND w."active" AND g."active" AND l."active" RETURNING "id"`;if(!rows.length)return null;await tx.$executeRaw`INSERT INTO "ItsmConsumableEvent" ("itemId","actorId","action","quantity","balance") VALUES (${rows[0].id},${user.employee.id},'created',0,0)`;return rows[0]});return item?NextResponse.json(item,{status:201,headers}):fail("انبار فعال نیست.");}catch(error){console.error('consumable create',error);return fail("ثبت ممکن نشد؛ کد قلم باید یکتا باشد.",409);}
 }
 if(d.action!=='receive'&&d.action!=='issue')return fail("عملیات معتبر نیست.");
 const itemId=d.itemId,quantity=d.quantity,recipientId=d.recipientId,note=text(d.note,1000);
 if(!id(itemId)||!integer(quantity)||quantity<1||!note||(d.action==='issue'&&!id(recipientId)))return fail("قلم، تعداد، توضیح و تحویل‌گیرنده معتبر را وارد کنید.");
 try{
 const result=await db.$transaction(async tx=>{
  const rows=await tx.$queryRaw<{id:number;warehouseId:number;quantity:number;locationId:number}[]>`SELECT c."id",c."warehouseId",c."quantity",w."locationId" FROM "ItsmConsumable" c JOIN "ItsmWarehouse" w ON w."id"=c."warehouseId" JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE c."id"=${itemId} AND w."active" AND g."active" AND l."active" FOR UPDATE OF c`;
  if(!rows.length)return 'notfound';const item=rows[0];
  if(!manager && !headIds.includes(item.warehouseId)){const access=await tx.$queryRaw<{id:number}[]>`SELECT c."id" FROM "ItsmWarehouseCustodian" c JOIN "ItsmWarehouse" w ON w."id"=c."warehouseId" JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "Employee" e ON e."id"=c."employeeId" JOIN "ItsmGroupMembership" m ON m."employeeId"=e."id" AND m."groupId"=w."groupId" JOIN "ItsmRoleGrant" r ON r."employeeId"=e."id" AND r."role" IN ('technician','group_head') WHERE c."warehouseId"=${item.warehouseId} AND e."id"=${user.employee.id} AND e."active" AND e."locationId"=w."locationId" AND w."active" AND g."active" AND l."active" FOR SHARE OF c,w,g,l,e,m,r`;if(!access.length)return 'forbidden';}
  if(d.action==='issue'){const recipients=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "Employee" WHERE "id"=${recipientId as number} AND "active" AND "locationId"=${item.locationId} FOR SHARE`;if(!recipients.length)return 'recipient';}
  const balance=d.action==='issue'?item.quantity-quantity:item.quantity+quantity;
  if(balance<0||balance>2147483647)return 'stock';
  await tx.$executeRaw`UPDATE "ItsmConsumable" SET "quantity"=${balance} WHERE "id"=${item.id}`;
  await tx.$executeRaw`INSERT INTO "ItsmConsumableEvent" ("itemId","actorId","recipientId","action","quantity","balance","note") VALUES (${item.id},${user.employee.id},${d.action==='issue'?recipientId as number:null},${d.action as string},${quantity},${balance},${note})`;
  return 'ok';
 });
 if(result==='notfound')return fail("قلم یا انبار فعال پیدا نشد.",404);if(result==='forbidden')return fail("دسترسی این انبار را ندارید.",403);if(result==='recipient')return fail("تحویل‌گیرنده فعال در محل انبار پیدا نشد.");if(result==='stock')return fail("موجودی کافی نیست یا از حد مجاز بیشتر می‌شود.",409);
 return NextResponse.json({ok:true},{headers});
 }catch(error){console.error('consumable movement',error);return fail("ثبت گردش ممکن نشد.",500);}
}
