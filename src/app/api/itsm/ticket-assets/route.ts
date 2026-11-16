import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const auth = await requireUser(); if (auth.err) return auth.err;
  if (!auth.user.locationId) return NextResponse.json({ error: "محل خدمت شما مشخص نیست." }, { status: 403, headers });
  const value = new URL(request.url).searchParams.get("beneficiaryId");
  const beneficiaryId = value === null ? auth.user.id : Number(value);
  if (!Number.isSafeInteger(beneficiaryId) || beneficiaryId < 1 || beneficiaryId > 2147483647) return NextResponse.json({ error: "همکار انتخاب‌شده معتبر نیست." }, { status: 400, headers });
  const beneficiary = await db.employee.findFirst({ where: { id: beneficiaryId, active: true, locationId: auth.user.locationId }, select: { id: true } });
  if (!beneficiary) return NextResponse.json({ error: "همکار فعال در محل خدمت شما پیدا نشد." }, { status: 404, headers });
  const assets = await db.$queryRaw`SELECT a."id", a."name", a."code", a."serial", a."brand", a."model", 'warehouse' AS "kind" FROM "ItsmAsset" a JOIN "ItsmWarehouse" w ON w."id" = a."warehouseId" WHERE a."assignedToId" = ${beneficiaryId} AND a."status" = 'assigned' AND w."locationId" = ${auth.user.locationId} UNION ALL SELECT p."id", p."name", p."computerName" AS "code", '' AS "serial", '' AS "brand", '' AS "model", 'personal' AS "kind" FROM "ItsmPersonalAsset" p WHERE p."employeeId"=${beneficiaryId} AND p."locationId"=${auth.user.locationId} AND p."active" ORDER BY "name", "code"`;
  return NextResponse.json(assets, { headers });
}
