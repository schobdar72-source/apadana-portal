import { Prisma } from "@prisma/client";
import { elapsedAt, type SlaRow } from "@/lib/itsm/sla-runtime";
import { isSlaPolicy, type SlaPolicy } from "@/lib/itsm/sla";

// پیوستن به آخرین چرخه SLA هر تیکت برای نمایش اولویت و وضعیت مهلت در فهرست‌ها.
// کوئری باید روی جدول ItsmTicket با نام مستعار t باشد.
export const latestSlaJoin = Prisma.sql`LEFT JOIN LATERAL (SELECT s."priority", s."state", s."policy", s."startedAt", s."segmentStartedAt", s."elapsedMs", s."responseAt", s."responseElapsedMs", s."endedAt" FROM "ItsmTicketSla" s WHERE s."ticketId" = t."id" ORDER BY s."id" DESC LIMIT 1) sla ON true`;

export const latestSlaSelect = Prisma.sql`sla."priority" AS "priority", sla."state" AS "slaState", sla."policy" AS "slaPolicy", sla."startedAt" AS "slaStartedAt", sla."segmentStartedAt" AS "slaSegmentStartedAt", sla."elapsedMs" AS "slaElapsedMs", sla."responseAt" AS "slaResponseAt", sla."responseElapsedMs" AS "slaResponseElapsedMs", sla."endedAt" AS "slaEndedAt"`;

// مرتب‌سازی صف بر اساس اولویت؛ تیکت‌های بحرانی و بالا جلوتر می‌آیند.
export const slaPriorityOrder = Prisma.sql`CASE sla."priority" WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`;

export type SlaListRow = {
  priority: string | null;
  slaState: string | null;
  slaPolicy: unknown;
  slaStartedAt: Date | null;
  slaSegmentStartedAt: Date | null;
  slaElapsedMs: bigint | null;
  slaResponseAt: Date | null;
  slaResponseElapsedMs: bigint | null;
  slaEndedAt: Date | null;
};

export type SlaBadge = { priority: string | null; sla: "breached" | "on_track" | "untracked" };

// محاسبه وضعیت مهلت با همان منطق گزارش‌ها (reports/route.ts) تا اعداد همه‌جا یکسان باشند.
export function slaBadgeOf(row: SlaListRow, now: Date): SlaBadge {
  if (!row.slaState || !row.slaStartedAt || !row.priority || !isSlaPolicy(row.slaPolicy)) return { priority: row.priority, sla: "untracked" };
  const policy = row.slaPolicy as SlaPolicy;
  const priority = row.priority as SlaRow["priority"];
  const cycle: SlaRow = { id: 0, ticketId: 0, policyVersionId: null, policy, priority, state: row.slaState, startedAt: row.slaStartedAt, segmentStartedAt: row.slaSegmentStartedAt, elapsedMs: row.slaElapsedMs ?? BigInt(0), responseAt: row.slaResponseAt, responseElapsedMs: row.slaResponseElapsedMs, endedAt: row.slaEndedAt };
  const elapsed = elapsedAt(cycle, now);
  const target = policy.targets[priority];
  if (row.slaState === "cancelled") return { priority: row.priority, sla: "untracked" };
  const response = row.slaResponseAt ? Number(row.slaResponseElapsedMs ?? 0) > target.response * 60000 : row.slaState !== "resolved" && elapsed >= target.response * 60000;
  const resolution = row.slaState === "resolved" ? elapsed > target.resolution * 60000 : elapsed >= target.resolution * 60000;
  return { priority: row.priority, sla: response || resolution ? "breached" : "on_track" };
}

// جداسازی فیلدهای خام SLA (که BigInt دارند و قابل serialize نیستند) از بقیه ردیف.
export function withSlaBadge<T extends SlaListRow>(row: T, now: Date): Omit<T, keyof SlaListRow> & SlaBadge {
  const { slaPolicy: _policy, slaStartedAt: _startedAt, slaSegmentStartedAt: _segmentStartedAt, slaElapsedMs: _elapsedMs, slaResponseAt: _responseAt, slaResponseElapsedMs: _responseElapsedMs, slaEndedAt: _endedAt, priority: _p, slaState: _s, ...rest } = row;
  return { ...rest, ...slaBadgeOf(row, now) };
}
