import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";

export const dynamic = "force-dynamic";
export async function GET() {
  const identity=await getItsmIdentity();
  const headers={"Cache-Control":"private, no-store"};
  if(!identity) return NextResponse.json({error:"ابتدا وارد شوید."},{status:401,headers});
  const manager=identity.roles.includes("it_manager"), head=identity.roles.includes("group_head"), technician=identity.roles.includes("technician");
  if(!manager && !head && !technician) return NextResponse.json({error:"دسترسی مجاز نیست."},{status:403,headers});
  const groups=identity.groups.map(group=>group.id), employeeId=identity.employee.id, locationId=identity.employee.locationId;
  const rows=await db.$queryRaw<{groupName:string; assigneeId:number|null; assignee:string; total:bigint; closed:bigint; rated:bigint; average:number|null}[]>`SELECT g."name" AS "groupName", t."assigneeId", COALESCE(concat_ws(' ',e."firstName",e."lastName"),'') AS "assignee", count(*) AS "total", count(*) FILTER (WHERE t."status" IN ('closed','resolved')) AS "closed", count(t."satisfaction") AS "rated", avg(t."satisfaction")::float AS "average" FROM "ItsmTicket" t JOIN "ItsmGroup" g ON g."id"=t."groupId" LEFT JOIN "Employee" e ON e."id"=t."assigneeId" WHERE (${manager} OR (${head} AND t."locationId"=${locationId} AND t."groupId"=ANY(${groups}::int[])) OR (${technician} AND t."locationId"=${locationId} AND t."assigneeId"=${employeeId})) GROUP BY g."name",t."assigneeId",e."firstName",e."lastName" ORDER BY g."name", "assignee"`;
  return NextResponse.json(rows.map(row=>({...row,total:Number(row.total),closed:Number(row.closed),rated:Number(row.rated)})),{headers});
}
