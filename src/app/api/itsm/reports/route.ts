import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";
import { elapsedAt, type SlaRow } from "@/lib/itsm/sla-runtime";
import { isSlaPolicy } from "@/lib/itsm/sla";
import { validReportRange } from "@/lib/itsm/report-date";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const statuses = ["waiting_assignment", "in_progress", "waiting_user", "waiting_action", "resolved", "closed", "cancelled"];
const priorities = ["critical", "high", "normal", "low"];
type Row = { id:number; title:string; status:string; groupId:number; groupName:string; locationId:number|null; locationName:string|null; assignee:string|null; createdAt:Date; slaId:number|null; priority:SlaRow["priority"]|null; policy:unknown; slaState:string|null; startedAt:Date|null; segmentStartedAt:Date|null; elapsedMs:bigint|null; responseAt:Date|null; responseElapsedMs:bigint|null; endedAt:Date|null };
function numberParam(value:string|null) { if (!value) return null; if (!/^\d{1,9}$/.test(value) || Number(value) < 1) throw Error("فیلتر انتخاب‌شده معتبر نیست."); return Number(value); }

export async function GET(request: NextRequest) {
  const identity = await getItsmIdentity();
  if (!identity) return NextResponse.json({error:"ابتدا وارد شوید."}, {status:401, headers});
  try {
    const params=request.nextUrl.searchParams, period=params.get("period") || "90", status=params.get("status") || "", priority=params.get("priority") || "";
    const from = params.get("from") || "", to = params.get("to") || "";
    if (!["30","90","365","all","custom"].includes(period) || (period === "custom" && !validReportRange(from, to)) || (status && !statuses.includes(status)) || (priority && !priorities.includes(priority))) throw Error("فیلتر انتخاب‌شده معتبر نیست.");
    const groupId=numberParam(params.get("groupId")), locationId=numberParam(params.get("locationId"));
    const manager=identity.roles.includes("it_manager"), head=identity.roles.includes("group_head"), technician=identity.roles.includes("technician");
    const personal=!manager && !head && !technician, employeeId=identity.employee.id, employeeLocation=identity.employee.locationId;
    const groupIds=identity.groups.map(g=>g.id), since=period === "all" || period === "custom" ? null : new Date(Date.now()-Number(period)*86400000);
    const rows=await db.$queryRaw<Row[]>`SELECT t."id",t."title",t."status",t."groupId",g."name" AS "groupName",t."locationId",l."name" AS "locationName",concat_ws(' ',e."firstName",e."lastName") AS "assignee",t."createdAt", s."id" AS "slaId",s."priority",s."policy",s."state" AS "slaState",s."startedAt",s."segmentStartedAt",s."elapsedMs",s."responseAt",s."responseElapsedMs",s."endedAt" FROM "ItsmTicket" t JOIN "ItsmGroup" g ON g."id"=t."groupId" LEFT JOIN "Location" l ON l."id"=t."locationId" LEFT JOIN "Employee" e ON e."id"=t."assigneeId" LEFT JOIN LATERAL (SELECT * FROM "ItsmTicketSla" s WHERE s."ticketId"=t."id" ORDER BY s."id" DESC LIMIT 1) s ON true WHERE (${manager} OR (${head} AND t."locationId"=${employeeLocation} AND t."groupId"=ANY(${groupIds}::int[])) OR (${technician} AND t."locationId"=${employeeLocation} AND t."assigneeId"=${employeeId}) OR (${personal} AND (t."requesterId"=${employeeId} OR t."beneficiaryId"=${employeeId}))) AND (${since}::timestamp IS NULL OR t."createdAt">=${since}) AND (${period} <> 'custom' OR ((t."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran')::date BETWEEN ${period === "custom" ? from : null}::date AND ${period === "custom" ? to : null}::date) AND (${groupId}::int IS NULL OR t."groupId"=${groupId}) AND (${locationId}::int IS NULL OR t."locationId"=${locationId}) AND (${status}='' OR t."status"=${status}) AND (${priority}='' OR s."priority"=${priority}) ORDER BY t."createdAt" DESC,t."id" DESC LIMIT 10001`;
    if(rows.length>10000) return NextResponse.json({error:"تعداد درخواست‌ها بیش از ۱۰٬۰۰۰ مورد است؛ بازه یا فیلتر محدودتری انتخاب کنید."},{status:422,headers});
    const now=new Date();
    const tickets=rows.map(r=>{
      let sla="untracked";
      if(r.slaId && r.startedAt && r.slaState && r.priority && isSlaPolicy(r.policy)) {
        const cycle:SlaRow={id:r.slaId,ticketId:r.id,policyVersionId:null,policy:r.policy,priority:r.priority,state:r.slaState,startedAt:r.startedAt,segmentStartedAt:r.segmentStartedAt,elapsedMs:r.elapsedMs??BigInt(0),responseAt:r.responseAt,responseElapsedMs:r.responseElapsedMs,endedAt:r.endedAt};
        const elapsed=elapsedAt(cycle,now), target=r.policy.targets[r.priority];
        if(r.slaState==='cancelled') sla='cancelled';
        else { const response=r.responseAt ? Number(r.responseElapsedMs??0)>target.response*60000 : r.slaState!=='resolved' && elapsed>=target.response*60000; const resolution=r.slaState==='resolved' ? elapsed>target.resolution*60000 : elapsed>=target.resolution*60000; sla=response||resolution?'breached':'on_track'; }
      }
      return {id:r.id,title:r.title,status:r.status,groupId:r.groupId,group:r.groupName,locationId:r.locationId,location:r.locationName || 'ثبت نشده',assignee:r.assignee || 'تخصیص نیافته',createdAt:r.createdAt,priority:r.priority,sla};
    });
    const groups=manager ? await db.$queryRaw<{id:number;name:string}[]>`SELECT "id","name" FROM "ItsmGroup" ORDER BY "name"` : head ? identity.groups : [];
    const locations=manager ? await db.$queryRaw<{id:number;name:string}[]>`SELECT "id","name" FROM "Location" ORDER BY "name"` : [];
    return NextResponse.json({tickets,groups,locations,scope:manager?'manager':head?'head':technician?'technician':'personal',generatedAt:now},{headers});
  } catch(error) { console.error('ITSM reports:',error); return NextResponse.json({error:error instanceof Error && error.message.includes('فیلتر') ? error.message : 'دریافت گزارش ممکن نشد.'},{status:error instanceof Error && error.message.includes('فیلتر')?400:500,headers}); }
}
