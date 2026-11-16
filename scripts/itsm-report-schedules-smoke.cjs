const { isolatedTestBase, verifyTestServer } = require('./itsm-test-safety.cjs');
const testBase = isolatedTestBase();
const { PrismaClient }=require('@prisma/client');
const crypto=require('crypto');
const { execFile }=require('child_process');
const { promisify }=require('util');
const execute=promisify(execFile), db=new PrismaClient(), prefix=`report-schedule-${crypto.randomBytes(6).toString('hex')}`;
let employee,outsider,location,group,category,ticketId,profileId,scheduleId;
const expect=(v,m)=>{if(!v)throw Error(m)};
async function api(person,path,method='GET',data){const r=await fetch(testBase+path,{method,headers:{cookie:`apadana_session=${person.session}`,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const body=await r.json();return {status:r.status,body};}
async function person(name){const user=await db.employee.create({data:{code:`${prefix}-${name}`,firstName:'آزمایشی',lastName:name,passwordHash:'unused',locationId:location.id}});const session=`${prefix}-${name}`;await db.session.create({data:{id:session,employeeId:user.id,expiresAt:new Date(Date.now()+600000)}});return {...user,session};}
async function worker(){return execute(process.execPath,[require.resolve('tsx/cli'),'scripts/itsm-reports-worker.ts','--once',`--schedule-id=${scheduleId}`],{timeout:100000});}
async function main(){
 location=await db.location.create({data:{name:prefix}});employee=await person('manager');outsider=await person('outsider');
 await db.$executeRaw`INSERT INTO "ItsmRoleGrant" ("employeeId","role") VALUES (${employee.id},'it_manager')`;
 group=(await db.$queryRaw`INSERT INTO "ItsmGroup" ("name") VALUES (${prefix}) RETURNING "id"`)[0];
 category=(await db.$queryRaw`INSERT INTO "ItsmCategory" ("name","groupId") VALUES (${prefix},${group.id}) RETURNING "id"`)[0];
 ticketId=(await db.$queryRaw`INSERT INTO "ItsmTicket" ("title","description","categoryId","groupId","requesterId","beneficiaryId","locationId","updatedAt") VALUES ('آزمایشی','آزمایشی',${category.id},${group.id},${outsider.id},${outsider.id},${location.id},CURRENT_TIMESTAMP) RETURNING "id"`)[0].id;
 let r=await api(employee,'/api/itsm/reports/profiles','POST',{name:'گزارش آزمایشی',filters:{period:'all',groupId:String(group.id),locationId:'',status:'',priority:''},columns:['id','title']});expect(r.status===201,`profile ${JSON.stringify(r)}`);profileId=r.body.id;
 const config={profileId,frequency:'daily',hour:8,minute:0,day:1,active:true};
 r=await api(outsider,'/api/itsm/reports/schedules','POST',config);expect(r.status===404,'other user scheduled profile');
 r=await api(employee,'/api/itsm/reports/schedules','POST',{...config,frequency:'monthly',day:29});expect(r.status===400,'invalid day accepted');
 r=await api(employee,'/api/itsm/reports/schedules','POST',config);expect(r.status===200,`schedule ${JSON.stringify(r)}`);
 r=await api(employee,'/api/itsm/reports/schedules');scheduleId=r.body.schedules.find(s=>s.profileId===profileId).id;
 await db.$executeRaw`UPDATE "ItsmReportSchedule" SET "nextRunAt"=CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE "id"=${scheduleId}`;
 await Promise.all([worker(),worker()]);
 for(let i=0;i<100;i++){r=await api(employee,'/api/itsm/reports/schedules');if(r.body.runs.length)break;await new Promise(resolve=>setTimeout(resolve,200));}
 expect(r.status===200&&r.body.runs.length===1,`duplicate or missing runs ${JSON.stringify(r)}`);const runId=r.body.runs[0].id;
 let snapshot=await api(employee,`/api/itsm/reports/runs?id=${runId}`);expect(snapshot.status===200&&snapshot.body.tickets.some(t=>t.id===ticketId),'generated snapshot missing ticket');
 expect((await api(outsider,`/api/itsm/reports/runs?id=${runId}`)).status===404,'snapshot exposed to other user');
 await db.$executeRaw`DELETE FROM "ItsmRoleGrant" WHERE "employeeId"=${employee.id} AND "role"='it_manager'`;
 snapshot=await api(employee,`/api/itsm/reports/runs?id=${runId}`);expect(snapshot.status===200&&!snapshot.body.tickets.some(t=>t.id===ticketId)&&snapshot.body.removed===1,'revoked permission exposed snapshot');
 r=await api(employee,'/api/itsm/reports/schedules','POST',{...config,active:false});expect(r.status===200,'pause failed');
 await db.$executeRaw`UPDATE "ItsmReportSchedule" SET "nextRunAt"=CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE "id"=${scheduleId}`;await worker();
 r=await api(employee,'/api/itsm/reports/schedules');expect(r.body.runs.length===1&&!r.body.schedules[0].active,'paused schedule ran');
 r=await api(employee,`/api/itsm/reports/profiles?id=${profileId}`,'DELETE');expect(r.status===200,'delete failed');profileId=undefined;
 r=await api(employee,'/api/itsm/reports/schedules');expect(r.body.runs.length===0&&r.body.schedules.length===0,'cascade cleanup failed');
 console.log('PASS: scheduling, concurrent worker, historical permissions, ownership and pause');
}
async function cleanup(){if(employee)await db.$executeRaw`DELETE FROM "ItsmReportSchedule" WHERE "employeeId"=${employee.id}`;if(profileId&&employee)await db.setting.deleteMany({where:{key:`itsm.report.profile.${employee.id}.${profileId}`}});if(ticketId)await db.$executeRaw`DELETE FROM "ItsmTicket" WHERE "id"=${ticketId}`;if(category)await db.$executeRaw`DELETE FROM "ItsmCategory" WHERE "id"=${category.id}`;if(group)await db.$executeRaw`DELETE FROM "ItsmGroup" WHERE "id"=${group.id}`;if(employee)await db.$executeRaw`DELETE FROM "ItsmRoleGrant" WHERE "employeeId"=${employee.id}`;for(const p of [employee,outsider])if(p){await db.session.deleteMany({where:{employeeId:p.id}});await db.employee.deleteMany({where:{id:p.id}});}if(location)await db.location.deleteMany({where:{id:location.id}});await db.$disconnect();}
verifyTestServer().then(main).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>cleanup().catch(e=>{console.error('cleanup',e);process.exitCode=1;}));
