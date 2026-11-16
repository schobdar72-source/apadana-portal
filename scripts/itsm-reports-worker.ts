import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { nextReportRun, type ScheduleSpec } from '../src/lib/itsm/report-schedule';

const db=new PrismaClient();
const base=new URL(process.env.ITSM_REPORT_BASE_URL || 'http://127.0.0.1:3000');
if(!['http:','https:'].includes(base.protocol)||!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||base.username||base.password)throw Error('ITSM_REPORT_BASE_URL must be a local server');
const idArg=process.argv.find(a=>a.startsWith('--schedule-id=')),onlyId=idArg?Number(idArg.slice(14)):null;
if(onlyId!==null&&(!Number.isSafeInteger(onlyId)||onlyId<1))throw Error('Invalid schedule id');
type Schedule=ScheduleSpec & {id:number;employeeId:number;profileId:string;nextRunAt:Date;leaseToken:string};
async function scan(){
 const due=await db.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmReportSchedule" WHERE "active"=true AND "nextRunAt"<=CURRENT_TIMESTAMP AND ("leaseUntil" IS NULL OR "leaseUntil"<CURRENT_TIMESTAMP) AND (${onlyId}::int IS NULL OR "id"=${onlyId}) ORDER BY "nextRunAt" LIMIT 100`;
 for(const {id} of due){
  const token=randomBytes(24).toString('hex');
  const claimed=await db.$queryRaw<Schedule[]>`UPDATE "ItsmReportSchedule" SET "leaseToken"=${token},"leaseUntil"=CURRENT_TIMESTAMP + INTERVAL '5 minutes' WHERE "id"=${id} AND "active"=true AND "nextRunAt"<=CURRENT_TIMESTAMP AND ("leaseUntil" IS NULL OR "leaseUntil"<CURRENT_TIMESTAMP) RETURNING *`;
  if(!claimed.length)continue;
  const s=claimed[0],key=`itsm.report.profile.${s.employeeId}.${s.profileId}`;
  let session:string|undefined;
  try{
   const [employee,profile]=await Promise.all([db.employee.findUnique({where:{id:s.employeeId},select:{active:true}}),db.setting.findUnique({where:{key}})]);
   if(!employee?.active||!profile){await db.$executeRaw`UPDATE "ItsmReportSchedule" SET "active"=false,"leaseToken"=NULL,"leaseUntil"=NULL,"lastError"=${'کاربر فعال یا گزارش ذخیره‌شده پیدا نشد.'} WHERE "id"=${s.id} AND "leaseToken"=${token}`;continue;}
   const p=JSON.parse(profile.value) as {name:string;filters:Record<string,string>;columns:string[]};
   if(typeof p.name!=='string'||!p.filters||!Array.isArray(p.columns))throw Error('Invalid report profile');
   session=randomBytes(32).toString('hex');await db.session.create({data:{id:session,employeeId:s.employeeId,expiresAt:new Date(Date.now()+120000)}});
   const url=new URL('/api/itsm/reports',base);url.search=new URLSearchParams(p.filters).toString();
   const response=await fetch(url,{headers:{cookie:`apadana_session=${session}`},signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error(`report API ${response.status}`);
   const data=await response.json() as {tickets:unknown[]};if(!Array.isArray(data.tickets)||data.tickets.length>10000)throw Error('Invalid report response');
   const next=nextReportRun(s,new Date()),tickets=JSON.stringify(data.tickets),columns=JSON.stringify(p.columns);
   await db.$transaction(async tx=>{
    const locked=await tx.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmReportSchedule" WHERE "id"=${s.id} AND "leaseToken"=${token} AND "active"=true FOR UPDATE`;if(!locked.length)return;
    await tx.$executeRaw`INSERT INTO "ItsmReportRun" ("scheduleId","employeeId","dueAt","profileName","columns","tickets") VALUES (${s.id},${s.employeeId},${s.nextRunAt},${p.name},${columns}::jsonb,${tickets}::jsonb) ON CONFLICT ("scheduleId","dueAt") DO NOTHING`;
    await tx.$executeRaw`UPDATE "ItsmReportSchedule" SET "nextRunAt"=${next},"leaseToken"=NULL,"leaseUntil"=NULL,"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${s.id}`;
   },{timeout:60000});
  }catch(error){console.error(`Report schedule ${s.id} failed:`,error);await db.$executeRaw`UPDATE "ItsmReportSchedule" SET "leaseToken"=NULL,"leaseUntil"=CURRENT_TIMESTAMP + INTERVAL '5 minutes',"lastError"=${'تولید گزارش ناموفق بود؛ پردازشگر دوباره تلاش می‌کند.'} WHERE "id"=${s.id} AND "leaseToken"=${token}`;}
  finally{if(session)await db.session.deleteMany({where:{id:session}});}
 }
 return due.length;
}
async function main(){do{try{if(!process.argv.includes('--once'))await db.setting.upsert({where:{key:'itsm.reports.worker.heartbeat'},create:{key:'itsm.reports.worker.heartbeat',value:new Date().toISOString()},update:{value:new Date().toISOString()}});const count=await scan();if(process.argv.includes('--once'))console.log(`Report schedules checked: ${count}`);}catch(error){console.error('Report worker scan failed',error);if(process.argv.includes('--once'))throw error;}if(process.argv.includes('--once'))break;await new Promise(resolve=>setTimeout(resolve,60000));}while(true);}
process.on('SIGINT',()=>{void db.$disconnect().finally(()=>process.exit(0));});
process.on('SIGTERM',()=>{void db.$disconnect().finally(()=>process.exit(0));});
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
