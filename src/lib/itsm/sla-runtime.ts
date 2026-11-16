import type { Prisma } from '@prisma/client';
import { isSlaPolicy, workingMillisecondsBetween, addWorkingMilliseconds, type SlaPolicy } from '@/lib/itsm/sla';

export type Priority='critical'|'high'|'normal'|'low';
export const DEFAULT_SLA:SlaPolicy={weekdays:[6,0,1,2,3],start:'08:00',end:'16:00',holidays:[],targets:{critical:{response:60,resolution:240},high:{response:120,resolution:480},normal:{response:240,resolution:960},low:{response:480,resolution:2400}}};
type Tx=Prisma.TransactionClient;
export type SlaRow={id:number;ticketId:number;policyVersionId:number|null;policy:unknown;priority:Priority;state:string;startedAt:Date;segmentStartedAt:Date|null;elapsedMs:bigint;responseAt:Date|null;responseElapsedMs:bigint|null;endedAt:Date|null};
export async function txNow(tx:Tx){return (await tx.$queryRaw<{now:Date}[]>`SELECT CURRENT_TIMESTAMP AS "now"`)[0].now;}
export async function currentSla(tx:Tx,ticketId:number){return (await tx.$queryRaw<SlaRow[]>`SELECT * FROM "ItsmTicketSla" WHERE "ticketId"=${ticketId} AND "state" IN ('running','paused') FOR UPDATE`)[0]??null;}
function policyOf(row:SlaRow):SlaPolicy{if(!isSlaPolicy(row.policy))throw Error('تنظیمات SLA ثبت‌شده معتبر نیست.');return row.policy;}
export function elapsedAt(row:SlaRow,now:Date):number{return Number(row.elapsedMs)+(row.state==='running'&&row.segmentStartedAt?workingMillisecondsBetween(row.segmentStartedAt,now,policyOf(row)):0);}
export async function startSla(tx:Tx,ticketId:number,actorId:number,now:Date,priority:Priority='normal',paused=false,respondedAt:Date|null=null,reason=''){
 const versions=await tx.$queryRaw<{id:number;policy:unknown}[]>`SELECT "id","policy" FROM "ItsmSlaPolicyVersion" ORDER BY "id" DESC LIMIT 1`;
 const version=versions[0];const policy=version?.policy??DEFAULT_SLA;if(!isSlaPolicy(policy))throw Error('تنظیمات SLA معتبر نیست.');const json=JSON.stringify(policy);
 await tx.$executeRaw`INSERT INTO "ItsmTicketSla" ("ticketId","policyVersionId","policy","priority","state","startedAt","segmentStartedAt","responseAt","responseElapsedMs","createdById","reason") VALUES (${ticketId},${version?.id??null},${json}::jsonb,${priority},${paused?'paused':'running'},${now},${paused?null:now},${respondedAt},${respondedAt?BigInt(0):null},${actorId},${reason})`;
 await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId","actorId","action") VALUES (${ticketId},${actorId},${`sla_started:${priority}`})`;
}
export async function transitionSla(tx:Tx,ticketId:number,actorId:number,now:Date,target:'pause'|'resume'|'resolved'|'cancelled'){
 const row=await currentSla(tx,ticketId);if(!row)return;
 const state=target==='pause'?'paused':target==='resume'?'running':target;
 if((target==='pause'&&row.state!=='running')||(target==='resume'&&row.state!=='paused'))return;
 const elapsed=BigInt(Math.round(elapsedAt(row,now)));
 await tx.$executeRaw`UPDATE "ItsmTicketSla" SET "state"=${state},"elapsedMs"=${elapsed},"segmentStartedAt"=${state==='running'?now:null},"endedAt"=${state==='resolved'||state==='cancelled'?now:null} WHERE "id"=${row.id}`;
 await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId","actorId","action") VALUES (${ticketId},${actorId},${`sla_${target}`})`;
}
export async function reopenSla(tx:Tx,ticketId:number,actorId:number,now:Date){
 const rows=await tx.$queryRaw<{id:number;state:string}[]>`SELECT "id","state" FROM "ItsmTicketSla" WHERE "ticketId"=${ticketId} ORDER BY "id" DESC LIMIT 1 FOR UPDATE`;
 if(rows[0]?.state!=='resolved')return;
 await tx.$executeRaw`UPDATE "ItsmTicketSla" SET "state"='running',"segmentStartedAt"=${now},"endedAt"=NULL WHERE "id"=${rows[0].id}`;
 await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId","actorId","action") VALUES (${ticketId},${actorId},'sla_reopened')`;
}
export async function markFirstResponse(tx:Tx,ticketId:number,actorId:number,now:Date){
 const row=await currentSla(tx,ticketId);if(!row||row.responseAt)return;
 const elapsed=BigInt(Math.round(elapsedAt(row,now)));
 await tx.$executeRaw`UPDATE "ItsmTicketSla" SET "responseAt"=${now},"responseElapsedMs"=${elapsed} WHERE "id"=${row.id}`;
 await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId","actorId","action") VALUES (${ticketId},${actorId},'sla_first_response')`;
}
export function slaView(row:SlaRow,now:Date){
 const policy=policyOf(row),elapsed=elapsedAt(row,now),target=policy.targets[row.priority];
 const responseMs=target.response*60000,resolutionMs=target.resolution*60000;
 function metric(limit:number,completed:number|null){const used=completed??elapsed,remaining=Math.max(0,limit-used);const status=completed!==null?(used>limit?'breached':'completed'):row.state==='cancelled'?'cancelled':used>=limit?'breached':row.state==='resolved'?'not_recorded':row.state==='paused'?'paused':remaining<=3600000?'warning':'on_track';const deadline=completed===null&&row.state==='running'&&remaining>0?addWorkingMilliseconds(now,remaining,policy).toISOString():null;return{status,usedMs:used,remainingMs:remaining,deadline};}
 return{priority:row.priority,state:row.state,policyVersionId:row.policyVersionId,startedAt:row.startedAt,responseAt:row.responseAt,response:metric(responseMs,row.responseAt?Number(row.responseElapsedMs??0):null),resolution:metric(resolutionMs,row.state==='resolved'?elapsed:null)};
}
