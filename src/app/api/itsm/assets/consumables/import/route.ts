import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getItsmIdentity } from '@/lib/itsm/access';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers});
const isId=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const clean=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
type Row={name:string;code:string;unit:string;warehouseId:number;minimum:number;quantity:number};
export async function POST(request:Request){
 const user=await getItsmIdentity();if(!user)return fail('ابتدا وارد شوید.',401);if(!user.roles.includes('it_manager'))return fail('فقط مدیر فناوری اطلاعات مجاز است.',403);
 if(Number(request.headers.get('content-length')||0)>256000)return fail('حجم داده بیش از حد مجاز است.',413);
 let body:unknown;try{body=await request.json()}catch{return fail('داده معتبر نیست.')}
 if(!Array.isArray(body)||body.length<1||body.length>200)return fail('فایل باید بین ۱ تا ۲۰۰ ردیف داشته باشد.');
 const rows:Row[]=[],codes=new Set<string>();
 for(let i=0;i<body.length;i++){const value=body[i];if(!value||typeof value!=='object'||Array.isArray(value))return fail(`ردیف ${i+2} معتبر نیست.`);const d=value as Record<string,unknown>,name=clean(d.name,120),code=clean(d.code,80),unit=clean(d.unit,30);
  if(!name||!code||!unit||!isId(d.warehouseId)||!count(d.minimum)||!count(d.quantity))return fail(`اطلاعات ردیف ${i+2} کامل یا معتبر نیست.`);
  if(codes.has(code))return fail(`کد قلم در ردیف ${i+2} تکراری است.`);codes.add(code);rows.push({name,code,unit,warehouseId:d.warehouseId,minimum:d.minimum,quantity:d.quantity});}
 try{await db.$transaction(async tx=>{for(let i=0;i<rows.length;i++){const row=rows[i],existing=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmConsumable" WHERE "code"=${row.code}`;if(existing.length)throw Error(`کد قلم ردیف ${i+2} قبلاً ثبت شده است.`);const inserted=await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmConsumable" ("warehouseId","name","code","unit","minimum","quantity") SELECT w."id",${row.name},${row.code},${row.unit},${row.minimum},${row.quantity} FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE w."id"=${row.warehouseId} AND w."active" AND g."active" AND l."active" RETURNING "id"`;if(!inserted.length)throw Error(`انبار ردیف ${i+2} فعال یا معتبر نیست.`);await tx.$executeRaw`INSERT INTO "ItsmConsumableEvent" ("itemId","actorId","action","quantity","balance","note") VALUES (${inserted[0].id},${user.employee.id},'created',0,0,'ورود گروهی از فایل')`;if(row.quantity>0)await tx.$executeRaw`INSERT INTO "ItsmConsumableEvent" ("itemId","actorId","action","quantity","balance","note") VALUES (${inserted[0].id},${user.employee.id},'receive',${row.quantity},${row.quantity},'موجودی اولیه از فایل')`;}});return NextResponse.json({count:rows.length},{status:201,headers});}catch(error){console.error('consumable import failed',error);const message=error instanceof Error&&(/^کد قلم ردیف|^انبار ردیف/.test(error.message))?error.message:'ورود انجام نشد؛ کدهای تکراری یا اطلاعات انبار را بررسی کنید.';return fail(message,409)}
}
