import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getItsmIdentity } from "@/lib/itsm/access";
import { db } from "@/lib/db";
import { validReportRange } from "@/lib/itsm/report-date";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const columns=["id","title","status","group","location","assignee","priority","sla","createdAt"];
const statuses=["","waiting_assignment","in_progress","waiting_user","waiting_action","resolved","closed","cancelled"];
const priorities=["","critical","high","normal","low"];
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
const prefix=(id:number)=>`itsm.report.profile.${id}.`;
function validId(s:unknown){return typeof s==='string' && /^[0-9a-f-]{36}$/.test(s);}
export async function GET(){
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 const rows=await db.setting.findMany({where:{key:{startsWith:prefix(user.employee.id)}},orderBy:{key:"asc"}});
 return NextResponse.json(rows.flatMap(r=>{try{return [JSON.parse(r.value)];}catch{return []}}),{headers});
}
export async function POST(request:NextRequest){
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 let body:any;try{body=await request.json();}catch{return fail("اطلاعات معتبر نیست.",400);}
 const name=typeof body?.name==='string'?body.name.trim():"", f=body?.filters, cols=body?.columns;
 if(!name || name.length>80 || !f || typeof f!=='object' || !["30","90","365","all","custom"].includes(f.period) || (f.period==='custom' && !validReportRange(f.from,f.to)) || !statuses.includes(f.status) || !priorities.includes(f.priority) || ![f.groupId,f.locationId].every((v:unknown)=>typeof v==='string' && (v==='' || /^[1-9]\d{0,8}$/.test(v))) || !Array.isArray(cols) || !cols.length || cols.length>columns.length || new Set(cols).size!==cols.length || !cols.every((c:unknown)=>typeof c==='string' && columns.includes(c))) return fail("نام، فیلترها یا ستون‌های گزارش معتبر نیست.",400);
 const count=await db.setting.count({where:{key:{startsWith:prefix(user.employee.id)}}});if(count>=30)return fail("حداکثر ۳۰ گزارش قابل ذخیره است.",400);
 const id=randomUUID(),value={id,name,filters:{period:f.period,groupId:f.groupId,locationId:f.locationId,status:f.status,priority:f.priority,...(f.period==='custom'?{from:f.from,to:f.to}:{})},columns:cols};
 await db.setting.create({data:{key:prefix(user.employee.id)+id,value:JSON.stringify(value)}});
 return NextResponse.json(value,{status:201,headers});
}
export async function DELETE(request:NextRequest){
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 const id=request.nextUrl.searchParams.get('id');if(!validId(id))return fail("شناسه معتبر نیست.",400);
 const removed=await db.$transaction(async tx=>{const rows=await tx.$queryRaw<{key:string}[]>`SELECT "key" FROM "Setting" WHERE "key"=${prefix(user.employee.id)+id} FOR UPDATE`;if(!rows.length)return false;await tx.$executeRaw`DELETE FROM "ItsmReportSchedule" WHERE "employeeId"=${user.employee.id} AND "profileId"=${id}`;await tx.setting.delete({where:{key:prefix(user.employee.id)+id}});return true;});
 return removed?NextResponse.json({ok:true},{headers}):fail("گزارش پیدا نشد.",404);
}
