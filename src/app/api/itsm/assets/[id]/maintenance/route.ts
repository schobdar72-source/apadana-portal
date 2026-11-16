import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getItsmIdentity } from "@/lib/itsm/access";
import { headedWarehouses } from "@/lib/itsm/warehouse-access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getItsmIdentity();
  if (!user) return fail("ابتدا وارد شوید.", 401);
  const assetId = Number(params.id);
  if (!/^\d+$/.test(params.id) || !Number.isSafeInteger(assetId) || assetId < 1 || assetId > 2147483647) return fail("دارایی معتبر نیست.");
  let data: Record<string, unknown>;
  try { data = await request.json(); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); } catch { return fail("اطلاعات معتبر نیست."); }
  const labels: Record<string, string> = { service: "سرویس", repair: "تعمیر", replacement: "تعویض", inspection: "بازبینی وضعیت" };
  const kind = typeof data.kind === "string" ? data.kind : "";
  const note = typeof data.note === "string" ? data.note.trim() : "";
  const date = typeof data.date === "string" ? data.date : "";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Object.hasOwn(labels, kind) || !note || note.length > 2000 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return fail("نوع، تاریخ و شرح معتبر وارد کنید.");
  const manager = user.roles.includes("it_manager");
  const warehouses = manager ? [] : await headedWarehouses(user.employee.id);
  const formattedDate = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeZone: "UTC" }).format(parsed);
  const details = `${labels[kind]} — تاریخ انجام: ${formattedDate} — ${note}`;
  const rows = await db.$queryRaw<{ id: number }[]>`INSERT INTO "ItsmAssetEvent" ("assetId", "actorId", "action", "note") SELECT a."id", ${user.employee.id}, 'maintenance', ${details} FROM "ItsmAsset" a WHERE a."id"=${assetId} AND (${manager} OR a."warehouseId"=ANY(${warehouses}::int[])) RETURNING "id"`;
  if (!rows.length) return fail("دارایی پیدا نشد یا دسترسی ندارید.", 404);
  return NextResponse.json({ ok: true }, { headers });
}
