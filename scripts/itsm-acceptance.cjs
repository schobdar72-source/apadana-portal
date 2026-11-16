const { loadEnvConfig }=require('@next/env');
const { PrismaClient }=require('@prisma/client');
const { randomBytes }=require('crypto');
const { spawn,spawnSync,execFile }=require('child_process');
const { promisify }=require('util');
const net=require('net');
const path=require('path');
const fs=require('fs/promises');
const exec=promisify(execFile);
loadEnvConfig(process.cwd());
const baseUrl=process.env.DATABASE_URL;
if(!baseUrl)throw Error('DATABASE_URL is required.');
const original=new URL(baseUrl),suffix=randomBytes(6).toString('hex'),name=`apadana_itsm_test_${suffix}`,dist=`.next-itsm-acceptance-${suffix}`,testUrl=new URL(baseUrl);
testUrl.pathname='/'+name;
const admin=new PrismaClient({datasources:{db:{url:baseUrl}}});
let server,created=false;
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
async function command(script,env,timeout=180000){try{const result=await exec(process.execPath,script,{env,timeout,maxBuffer:2*1024*1024,windowsHide:true});if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);}catch(e){if(e.stdout)process.stdout.write(e.stdout);if(e.stderr)process.stderr.write(e.stderr);throw Error(`Acceptance command failed: ${path.basename(script[0])}`);}}
async function ready(base,token){for(let i=0;i<180;i++){if(server.exitCode!==null)throw Error('Isolated server exited during startup.');try{const r=await fetch(base+'/api/itsm/test-identity',{headers:{'x-itsm-test-token':token},signal:AbortSignal.timeout(1500)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Isolated server did not become ready.');}
async function stopServer(){if(!server || server.exitCode!==null)return;if(process.platform==='win32'){try{await exec('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true});}catch{server.kill();}}else server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,5000).unref();});}
async function testRestore(container){
 if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(container)||!['localhost','127.0.0.1','[::1]'].includes(original.hostname))throw Error('Unsafe restore-test configuration.');
 const restoreName=`apadana_itsm_test_${randomBytes(6).toString('hex')}`;let restoreCreated=false,source,restored;
 try{
  source=new PrismaClient({datasources:{db:{url:testUrl.toString()}}});
  await source.setting.create({data:{key:'itsm.acceptance.backup-marker',value:suffix}});
  const dump=spawnSync('docker',['exec',container,'pg_dump','-U','postgres','-Fc','-d',name],{windowsHide:true,maxBuffer:50*1024*1024,timeout:60000});if(dump.status!==0)throw Error('Isolated database backup failed.');
  if(!/^apadana_itsm_test_[a-f0-9]{12}$/.test(restoreName))throw Error('Unsafe restore database');
  await admin.$executeRawUnsafe(`CREATE DATABASE "${restoreName}"`);restoreCreated=true;
  const restore=spawnSync('docker',['exec','-i',container,'pg_restore','-U','postgres','--exit-on-error','-d',restoreName],{input:dump.stdout,windowsHide:true,maxBuffer:2*1024*1024,timeout:60000});if(restore.status!==0)throw Error('Isolated database restoration failed.');
  const restoreUrl=new URL(testUrl);restoreUrl.pathname='/'+restoreName;restored=new PrismaClient({datasources:{db:{url:restoreUrl.toString()}}});
  const marker=await restored.setting.findUnique({where:{key:'itsm.acceptance.backup-marker'}});if(marker?.value!==suffix)throw Error('Restored test data did not match.');
  console.log('PASS: isolated backup and restore.');
 }finally{if(restored)await restored.$disconnect();if(source)await source.$disconnect();if(restoreCreated)await admin.$executeRawUnsafe(`DROP DATABASE "${restoreName}" WITH (FORCE)`);}
}
async function main(){
 if(!/^apadana_itsm_test_[a-f0-9]{12}$/.test(name))throw Error('Unsafe database name');
 await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);created=true;
 const port=await freePort(),base=`http://127.0.0.1:${port}`,token=randomBytes(16).toString('hex');
 const env={...process.env,DATABASE_URL:testUrl.toString(),ITSM_TEST_ISOLATED:'1',ITSM_TEST_BASE_URL:base,ITSM_REPORT_BASE_URL:base,ITSM_TEST_DIST_DIR:dist,ITSM_TEST_TOKEN:token};
 console.log('Preparing isolated ITSM database and application.');
 await command([path.resolve('node_modules/prisma/build/index.js'),'migrate','deploy'],env);
 await command([path.resolve('scripts/seed-itsm-sla.cjs')],env);
 server=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{env,stdio:'ignore',windowsHide:true});
 await ready(base,token);
 console.log('Running isolated integration, assets, schedules and security checks.');
 const checks=['scripts/itsm-integration-smoke.cjs','scripts/itsm-assets-smoke.cjs','scripts/itsm-report-schedules-smoke.cjs','scripts/itsm-acceptance-security.cjs'];
 const results=[];
 for(const file of checks){try{await command([path.resolve(file)],env);results.push({status:'fulfilled'});}catch(error){console.error(error.message);results.push({status:'rejected'});}}
 if(results.some(r=>r.status==='rejected'))throw Error('One or more isolated acceptance checks failed.');
 await command([path.resolve('node_modules/tsx/dist/cli.mjs'),'scripts/test-itsm-sla.ts'],env);
 await command([path.resolve('node_modules/tsx/dist/cli.mjs'),'scripts/test-itsm-report-schedule.ts'],env);
 if(process.env.ITSM_TEST_PG_CONTAINER)await testRestore(process.env.ITSM_TEST_PG_CONTAINER);
 console.log('PASS: isolated ITSM acceptance checks.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
 try{await stopServer();if(created){if(!/^apadana_itsm_test_[a-f0-9]{12}$/.test(name))throw Error('Unsafe cleanup target');await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);}const dir=path.resolve(dist);if(path.dirname(dir)===process.cwd()&&/^\.next-itsm-acceptance-[a-f0-9]{12}$/.test(path.basename(dir)))await fs.rm(dir,{recursive:true,force:true});console.log('Isolated test resources removed.');}catch(error){console.error('Isolated cleanup failed:',error.message);process.exitCode=1;}finally{await admin.$disconnect();}
});
