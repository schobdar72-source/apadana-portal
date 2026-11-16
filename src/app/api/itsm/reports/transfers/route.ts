import { NextResponse } from "next/server";
import { getItsmIdentity } from "@/lib/itsm/access";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const identity = await getItsmIdentity();
  if (!identity) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401, headers });
  const manager=identity.roles.includes("it_manager"), head=identity.roles.includes("group_head"), technician=identity.roles.includes("technician");
  if (!manager && !head && !technician) return NextResponse.json({ error: "دسترسی به گزارش ارجاع‌ها ندارید." }, { status: 403, headers });
  const groups=identity.groups.map(group=>group.id), employeeId=identity.employee.id, locationId=identity.employee.locationId;
  const transfers=await db.$queryRaw`SELECT x."id",x."ticketId",t."title",source."name" AS "source",destination."name" AS "destination",l."name" AS "location",x."state",x."reason",x."createdAt",x."decidedAt" FROM "ItsmTransfer" x JOIN "ItsmTicket" t ON t."id"=x."ticketId" JOIN "ItsmGroup" source ON source."id"=x."sourceGroupId" JOIN "ItsmGroup" destination ON destination."id"=x."destinationGroupId" LEFT JOIN "Location" l ON l."id"=t."locationId" WHERE ${manager} OR (${head} AND t."locationId"=${locationId} AND (x."sourceGroupId"=ANY(${groups}::int[]) OR x."destinationGroupId"=ANY(${groups}::int[]))) OR (${technician} AND t."locationId"=${locationId} AND (x."requestedById"=${employeeId} OR x."previousAssigneeId"=${employeeId})) ORDER BY x."createdAt" DESC,x."id" DESC LIMIT 10001`;
  if ((transfers as unknown[]).length > 10000) return NextResponse.json({ error: "گزارش بیش از ۱۰٬۰۰۰ ارجاع دارد؛ برای دریافت کامل به فیلتر سروری نیاز است." }, { status: 422, headers });
  return NextResponse.json(transfers, { headers });
}
