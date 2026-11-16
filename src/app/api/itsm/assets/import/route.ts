import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers});
const isId=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const clean=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
type Row={name:string;code:string;categoryId:number;warehouseId:number;serial:string;brand:string;model:string};
export async function POST(request:Request){
 const user=await getItsmIdentity();if(!user)return fail('ابتدا وارد شوید.',401);if(!user.roles.includes('it_manager'))return fail('فقط مدیر فناوری اطلاعات مجاز است.',403);
 if(Number(request.headers.get('content-length')||0)>256000)return fail('حجم داده بیش از حد مجاز است.',413);
 let body:unknown;try{body=await request.json()}catch{return fail('داده معتبر نیست.')}
 if(!Array.isArray(body)||body.length<1||body.length>200)return fail('فایل باید بین ۱ تا ۲۰۰ ردیف دارایی داشته باشد.');
 const rows:Row[]=[],codes=new Set<string>();
 for(let i=0;i<body.length;i++){
  const value=body[i];if(!value||typeof value!=='object'||Array.isArray(value))return fail(`ردیف ${i+2} معتبر نیست.`);
  const d=value as Record<string,unknown>,name=clean(d.name,120),code=clean(d.code,80),serial=clean(d.serial,120),brand=clean(d.brand,120),model=clean(d.model,120);
  if(!name||!code||!isId(d.categoryId)||!isId(d.warehouseId)||['serial','brand','model'].some(k=>typeof d[k]!=='string'||(d[k] as string).trim().length>120))return fail(`اطلاعات ردیف ${i+2} کامل یا معتبر نیست.`);
  if(codes.has(code))return fail(`کد دارایی در ردیف ${i+2} تکراری است.`);codes.add(code);rows.push({name,code,categoryId:d.categoryId,warehouseId:d.warehouseId,serial,brand,model});
 }
 try{await db.$transaction(async tx=>{for(let i=0;i<rows.length;i++){const row=rows[i];const existing=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmAsset" WHERE "code"=${row.code}`;if(existing.length)throw Error(`کد دارایی ردیف ${i+2} قبلاً ثبت شده است.`);const inserted=await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmAsset" ("name","code","serial","brand","model","categoryId","warehouseId") SELECT ${row.name},${row.code},${row.serial},${row.brand},${row.model},c."id",w."id" FROM "ItsmAssetCategory" c CROSS JOIN "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE c."id"=${row.categoryId} AND c."active" AND w."id"=${row.warehouseId} AND w."active" AND g."active" AND l."active" RETURNING "id"`;if(!inserted.length)throw Error(`دسته یا انبار ردیف ${i+2} فعال یا معتبر نیست.`);await tx.$executeRaw`INSERT INTO "ItsmAssetEvent" ("assetId","actorId","action","note") VALUES (${inserted[0].id},${user.employee.id},'created','ورود گروهی از فایل')`;}});return NextResponse.json({count:rows.length},{status:201,headers});}catch(error){console.error('asset import failed',error);const message=error instanceof Error&&(/^کد دارایی ردیف|^دسته یا انبار ردیف/.test(error.message))?error.message:'ورود انجام نشد؛ کدهای تکراری یا اطلاعات انبار را بررسی کنید.';return fail(message,409)}
}
