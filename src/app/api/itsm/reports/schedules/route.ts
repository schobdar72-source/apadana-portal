import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";
import { nextReportRun, validSchedule } from "@/lib/itsm/report-schedule";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
const profileKey=(employeeId:number,id:string)=>`itsm.report.profile.${employeeId}.${id}`;
export async function GET(request:NextRequest){
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 const cursor=request.nextUrl.searchParams.get('before');if(cursor && !/^[1-9]\d{0,8}$/.test(cursor))return fail("شناسه معتبر نیست.",400);const before=cursor?Number(cursor):null;
 const schedules=await db.$queryRaw`SELECT "id","profileId","frequency","hour","minute","day","active","nextRunAt","lastError" FROM "ItsmReportSchedule" WHERE "employeeId"=${user.employee.id} ORDER BY "id"`;
 const rows=await db.$queryRaw<{id:number}[]>`SELECT "id","scheduleId","profileName","dueAt","createdAt","readAt" FROM "ItsmReportRun" WHERE "employeeId"=${user.employee.id} AND (${before}::int IS NULL OR "id"<${before}) ORDER BY "id" DESC LIMIT 101`;
 const unread=await db.$queryRaw<{count:number}[]>`SELECT COUNT(*)::int AS "count" FROM "ItsmReportRun" WHERE "employeeId"=${user.employee.id} AND "readAt" IS NULL`;
 const heartbeat=await db.setting.findUnique({where:{key:'itsm.reports.worker.heartbeat'}});
 const age=heartbeat ? Date.now()-Date.parse(heartbeat.value) : Infinity;
 return NextResponse.json({schedules,runs:rows.slice(0,100),hasMore:rows.length>100,unreadCount:unread[0].count,workerOnline:Number.isFinite(age)&&age>=0&&age<180000},{headers});
}
export async function POST(request:NextRequest){
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 let body:unknown;try{body=await request.json();}catch{return fail("اطلاعات معتبر نیست.",400);}
 const b=body as {profileId?:unknown;active?:unknown;frequency?:unknown;hour?:unknown;minute?:unknown;day?:unknown};
 if(!b || typeof b.profileId!=='string' || !/^[0-9a-f-]{36}$/.test(b.profileId) || typeof b.active!=='boolean' || !validSchedule(b))return fail("تنظیمات زمان‌بندی معتبر نیست.",400);
 const profileId=(body as {profileId:string}).profileId, active=(body as {active:boolean}).active;
 const next=nextReportRun(b,new Date());
 const exists=await db.$transaction(async tx=>{const profile=await tx.$queryRaw<{key:string}[]>`SELECT "key" FROM "Setting" WHERE "key"=${profileKey(user.employee.id,profileId)} FOR UPDATE`;if(!profile.length)return false;
 await tx.$executeRaw`INSERT INTO "ItsmReportSchedule" ("employeeId","profileId","frequency","hour","minute","day","active","nextRunAt") VALUES (${user.employee.id},${profileId},${b.frequency},${b.hour},${b.minute},${b.day},${active},${next}) ON CONFLICT ("employeeId","profileId") DO UPDATE SET "frequency"=EXCLUDED."frequency","hour"=EXCLUDED."hour","minute"=EXCLUDED."minute","day"=EXCLUDED."day","active"=EXCLUDED."active","nextRunAt"=EXCLUDED."nextRunAt","leaseToken"=NULL,"leaseUntil"=NULL,"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP`;return true;});
 if(!exists)return fail("گزارش ذخیره‌شده پیدا نشد.",404);
 return NextResponse.json({ok:true,nextRunAt:next},{headers});
}
