import { PrismaClient } from '@prisma/client';
import { slaView,type SlaRow } from '../src/lib/itsm/sla-runtime';

const db=new PrismaClient();
const onlyArg=process.argv.find(value=>value.startsWith('--ticket-id='));
const onlyId=onlyArg?Number(onlyArg.slice('--ticket-id='.length)):null;
if(onlyId!==null&&(!Number.isSafeInteger(onlyId)||onlyId<1||onlyId>2147483647))throw Error('Invalid ticket id');
async function scan(){
 let cursor=0,created=0;
 for(;;){
  const tickets=await db.$queryRaw<{id:number}[]>`SELECT "id" FROM "ItsmTicket" WHERE "id">${cursor} AND (${onlyId}::int IS NULL OR "id"=${onlyId}) AND "assigneeId" IS NOT NULL AND "status"<>'cancelled' ORDER BY "id" LIMIT 200`;
  if(!tickets.length)break;
  for(const item of tickets){cursor=item.id;
   created+=await db.$transaction(async tx=>{
    const tickets=await tx.$queryRaw<{assigneeId:number|null;active:boolean}[]>`SELECT t."assigneeId",e."active" FROM "ItsmTicket" t LEFT JOIN "Employee" e ON e."id"=t."assigneeId" WHERE t."id"=${item.id} AND t."status"<>'cancelled' FOR UPDATE OF t`;
    if(!tickets.length||!tickets[0].assigneeId||!tickets[0].active)return 0;
    const rows=await tx.$queryRaw<SlaRow[]>`SELECT * FROM "ItsmTicketSla" WHERE "ticketId"=${item.id} ORDER BY "id" DESC LIMIT 1 FOR UPDATE`;
    if(!rows.length||!['running','paused','resolved'].includes(rows[0].state))return 0;
    const now=(await tx.$queryRaw<{now:Date}[]>`SELECT CURRENT_TIMESTAMP AS "now"`)[0].now,view=slaView(rows[0],now),recipient=tickets[0].assigneeId;let count=0;
    for(const metric of ['response','resolution'] as const){const status=view[metric].status;if(status!=='warning'&&status!=='breached')continue;const kind=status==='breached'?'breach':'warning';
     const inserted=await tx.$queryRaw<{id:number}[]>`INSERT INTO "ItsmSlaNotice" ("slaId","ticketId","recipientId","metric","kind") VALUES (${rows[0].id},${item.id},${recipient},${metric},${kind}) ON CONFLICT ("slaId","recipientId","metric","kind") DO NOTHING RETURNING "id"`;count+=inserted.length;
    }
    return count;
   });
  }
 }
 return created;
}
async function main(){
 do{try{const count=await scan();if(process.argv.includes('--once'))console.log(`SLA notices created: ${count}`);}catch(error){console.error('SLA worker scan failed',error);if(process.argv.includes('--once'))throw error;}
  if(process.argv.includes('--once'))break;
  await new Promise(resolve=>setTimeout(resolve,60000));
 }while(true);
}
process.on('SIGINT',()=>{void db.$disconnect().finally(()=>process.exit(0))});
process.on('SIGTERM',()=>{void db.$disconnect().finally(()=>process.exit(0))});
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>db.$disconnect());
