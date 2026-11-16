const { isolatedTestBase, verifyTestServer }=require('./itsm-test-safety.cjs');
const { PrismaClient }=require('@prisma/client');
const crypto=require('crypto');
const base=isolatedTestBase(),db=new PrismaClient(),prefix=`itsm-security-${crypto.randomBytes(6).toString('hex')}`;
let inactive,missingLocation;
function check(value,message){if(!value)throw Error(message);}
async function main(){
 for(const path of ['/api/itsm/me','/api/itsm/tickets','/api/itsm/reports','/api/itsm/reports/schedules','/api/itsm/assets']){const r=await fetch(base+path);check(r.status===401,`${path}: anonymous ${r.status}`);}
 inactive=await db.employee.create({data:{code:prefix+'-inactive',firstName:'آزمایشی',lastName:'غیرفعال',passwordHash:'unused',active:false}});
 missingLocation=await db.employee.create({data:{code:prefix+'-no-location',firstName:'آزمایشی',lastName:'بدون محل',passwordHash:'unused'}});
 for(const person of [inactive,missingLocation])await db.session.create({data:{id:`${prefix}-${person.id}`,employeeId:person.id,expiresAt:new Date(Date.now()+600000)}});
 let r=await fetch(base+'/api/itsm/me',{headers:{cookie:`apadana_session=${prefix}-${inactive.id}`}});check(r.status===401,'inactive user session accepted');
 r=await fetch(base+'/api/itsm/tickets',{method:'POST',headers:{cookie:`apadana_session=${prefix}-${missingLocation.id}`,'content-type':'application/json'},body:JSON.stringify({title:'درخواست آزمایشی',description:'شرح آزمایشی',contactExtension:'123',categoryId:1})});check(r.status===400,'ticket without location accepted');
 r=await fetch(base+'/api/itsm/queue',{headers:{cookie:`apadana_session=${prefix}-${missingLocation.id}`}});check(r.status===200&&(await r.json()).length===0,'queue without location exposed records');
 console.log('PASS: anonymous and inactive accounts, missing location');
}
async function cleanup(){for(const p of [inactive,missingLocation])if(p){await db.session.deleteMany({where:{employeeId:p.id}});await db.employee.deleteMany({where:{id:p.id}});}await db.$disconnect();}
verifyTestServer().then(main).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>cleanup().catch(e=>{console.error('cleanup failed',e);process.exitCode=1;}));
