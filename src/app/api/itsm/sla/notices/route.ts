import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guard';
import { db } from '@/lib/db';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 const auth=await requireUser();if(auth.err)return auth.err;
 const notices=await db.$queryRaw`SELECT n."id",n."ticketId",n."metric",n."kind",n."createdAt",n."readAt",t."title" FROM "ItsmSlaNotice" n JOIN "ItsmTicket" t ON t."id"=n."ticketId" WHERE n."recipientId"=${auth.user.id} AND t."assigneeId"=${auth.user.id} ORDER BY n."createdAt" DESC,n."id" DESC LIMIT 50`;
 return NextResponse.json(notices,{headers});
}
export async function POST(request:Request){
 const auth=await requireUser();if(auth.err)return auth.err;let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'داده معتبر نیست.'},{status:400,headers})}
 const id=body&&typeof body==='object'&&!Array.isArray(body)?(body as {id?:unknown}).id:null;
 if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1||id>2147483647)return NextResponse.json({error:'اعلان معتبر نیست.'},{status:400,headers});
 const rows=await db.$queryRaw<{id:number}[]>`UPDATE "ItsmSlaNotice" n SET "readAt"=COALESCE(n."readAt",CURRENT_TIMESTAMP) FROM "ItsmTicket" t WHERE n."id"=${id} AND n."ticketId"=t."id" AND n."recipientId"=${auth.user.id} AND t."assigneeId"=${auth.user.id} RETURNING n."id"`;
 return rows.length?NextResponse.json({ok:true},{headers}):NextResponse.json({error:'اعلان پیدا نشد.'},{status:404,headers});
}
