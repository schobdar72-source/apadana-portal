import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
type Ticket={id:number;[key:string]:unknown};
export async function GET(request:NextRequest){
 const user=await getItsmIdentity();if(!user)return fail("ابتدا وارد شوید.",401);
 const value=request.nextUrl.searchParams.get('id');if(!value || !/^[1-9]\d{0,8}$/.test(value))return fail("شناسه معتبر نیست.",400);
 const id=Number(value), employeeId=user.employee.id;
 const runs=await db.$queryRaw<{id:number;profileName:string;createdAt:Date;columns:unknown;tickets:unknown}[]>`SELECT "id","profileName","createdAt","columns","tickets" FROM "ItsmReportRun" WHERE "id"=${id} AND "employeeId"=${employeeId}`;
 if(!runs.length)return fail("گزارش پیدا نشد.",404);
 const run=runs[0],tickets=Array.isArray(run.tickets)?run.tickets.filter((t):t is Ticket=>!!t && typeof t==='object' && Number.isSafeInteger(t.id)):[];
 const ids=tickets.map(t=>t.id), manager=user.roles.includes('it_manager'),head=user.roles.includes('group_head'),technician=user.roles.includes('technician'),personal=!manager&&!head&&!technician,location=user.employee.locationId,groups=user.groups.map(g=>g.id);
 // نسخه تاریخی فقط برای تیکت‌هایی بازگردانده می‌شود که در زمان مشاهده هنوز مجازند.
 const allowed=await db.$queryRaw<{id:number}[]>`SELECT t."id" FROM "ItsmTicket" t WHERE t."id"=ANY(${ids}::int[]) AND (${manager} OR (${head} AND t."locationId"=${location} AND t."groupId"=ANY(${groups}::int[])) OR (${technician} AND t."locationId"=${location} AND t."assigneeId"=${employeeId}) OR (${personal} AND (t."requesterId"=${employeeId} OR t."beneficiaryId"=${employeeId})))`;
 const permit=new Set(allowed.map(t=>t.id)),visible=tickets.filter(t=>permit.has(t.id));
 await db.$executeRaw`UPDATE "ItsmReportRun" SET "readAt"=COALESCE("readAt",CURRENT_TIMESTAMP) WHERE "id"=${id} AND "employeeId"=${employeeId}`;
 return NextResponse.json({id:run.id,name:run.profileName,createdAt:run.createdAt,columns:run.columns,tickets:visible,removed:tickets.length-visible.length},{headers});
}
