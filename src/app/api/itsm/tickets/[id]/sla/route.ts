import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guard';
import { db } from '@/lib/db';
import { currentSla,elapsedAt,slaView,startSla,txNow,type Priority,type SlaRow } from '@/lib/itsm/sla-runtime';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers});
const valid=(n:number)=>Number.isSafeInteger(n)&&n>0&&n<=2147483647;
export async function GET(_request:Request,{params}:{params:{id:string}}){
 const auth=await requireUser();if(auth.err)return auth.err;const id=Number(params.id);if(!valid(id))return fail('تیکت پیدا نشد.',404);
 const allowed=await db.$queryRaw<{id:number}[]>`SELECT t."id" FROM "ItsmTicket" t WHERE t."id"=${id} AND (t."requesterId"=${auth.user.id} OR t."beneficiaryId"=${auth.user.id} OR t."assigneeId"=${auth.user.id} OR ${queueTicketAccess(auth.user.id, auth.user.locationId)} OR EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId"=${auth.user.id} AND r."role"='it_manager'))`;
 if(!allowed.length)return fail('تیکت پیدا نشد.',404);
 const rows=await db.$queryRaw<SlaRow[]>`SELECT * FROM "ItsmTicketSla" WHERE "ticketId"=${id} ORDER BY "id" DESC LIMIT 1`;
 return NextResponse.json(rows.length?slaView(rows[0],new Date()):null,{headers});
}
export async function POST(request:Request,{params}:{params:{id:string}}){
 const auth=await requireUser();if(auth.err)return auth.err;const id=Number(params.id);if(!valid(id))return fail('تیکت پیدا نشد.',404);
 let d:Record<string,unknown>;try{d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw Error()}catch{return fail('اطلاعات معتبر نیست.')}
 const priority=d.priority,reason=typeof d.reason==='string'?d.reason.trim():'';
 if(typeof priority!=='string'||!['critical','high','normal','low'].includes(priority)||!reason||reason.length>500)return fail('اولویت و دلیل تا ۵۰۰ نویسه الزامی است.');
 const result=await db.$transaction(async tx=>{
  const rows=await tx.$queryRaw<{assigneeId:number|null;status:string;groupId:number;locationId:number|null}[]>`SELECT "assigneeId","status","groupId","locationId" FROM "ItsmTicket" WHERE "id"=${id} FOR UPDATE`;
  if(!rows.length)return 'notfound';const ticket=rows[0];if(['resolved','closed','cancelled'].includes(ticket.status))return 'conflict';
  const isHead=await tx.$queryRaw<{id:number}[]>`SELECT m."id" FROM "ItsmGroupMembership" m JOIN "ItsmRoleGrant" r ON r."employeeId"=m."employeeId" AND r."role"='group_head' JOIN "Employee" e ON e."id"=m."employeeId" JOIN "ItsmGroup" g ON g."id"=m."groupId" WHERE m."employeeId"=${auth.user.id} AND m."groupId"=${ticket.groupId} AND e."active" AND g."active" AND e."locationId"=${ticket.locationId} FOR SHARE OF m,r,e,g`;
  if(ticket.assigneeId!==auth.user.id&&!isHead.length)return 'forbidden';
  const row=await currentSla(tx,id);if(!row||row.priority===priority)return 'conflict';const now=await txNow(tx),elapsed=BigInt(Math.round(elapsedAt(row,now)));
  await tx.$executeRaw`UPDATE "ItsmTicketSla" SET "state"='superseded',"elapsedMs"=${elapsed},"segmentStartedAt"=NULL,"endedAt"=${now} WHERE "id"=${row.id}`;
  await startSla(tx,id,auth.user.id,now,priority as Priority,row.state==='paused',row.responseAt,reason);
  await tx.$executeRaw`INSERT INTO "ItsmTicketEvent" ("ticketId","actorId","action") VALUES (${id},${auth.user.id},${`priority:${row.priority}->${priority}:${reason}`})`;
  return 'ok';
 });
 if(result==='notfound')return fail('تیکت پیدا نشد.',404);if(result==='forbidden')return fail('دسترسی تغییر اولویت ندارید.',403);if(result!=='ok')return fail('اولویت یکسان است یا SLA فعال برای این تیکت وجود ندارد.',409);return NextResponse.json({ok:true},{headers});
}
import { queueTicketAccess } from '@/lib/itsm/queue-access';
