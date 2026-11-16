export type SlaPolicy = {
  weekdays: number[];
  start: string;
  end: string;
  holidays: string[];
  targets: Record<"critical" | "high" | "normal" | "low", { response: number; resolution: number }>;
};

export const SLA_PRIORITIES = ["critical", "high", "normal", "low"] as const;
const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function parts(instant: Date) {
  const fields = Object.fromEntries(dateFormat.formatToParts(instant).filter((item) => item.type !== "literal").map((item) => [item.type, Number(item.value)]));
  return { year: fields.year, month: fields.month, day: fields.day, hour: fields.hour, minute: fields.minute, second: fields.second };
}
function localToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let i = 0; i < 4; i++) {
    const local = parts(new Date(guess));
    const correction = desired - Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    if (!correction) return new Date(guess);
    guess += correction;
  }
  throw new Error("ساعت محلی انتخاب‌شده معتبر نیست.");
}
function isoDate(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function validDay(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
export function isSlaPolicy(value: unknown): value is SlaPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const policy = value as SlaPolicy;
  if (!Array.isArray(policy.weekdays) || !policy.weekdays.length || policy.weekdays.length > 7 || new Set(policy.weekdays).size !== policy.weekdays.length || !policy.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return false;
  if (typeof policy.start !== "string" || typeof policy.end !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(policy.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(policy.end) || policy.start >= policy.end) return false;
  if (!Array.isArray(policy.holidays) || policy.holidays.length > 1000 || new Set(policy.holidays).size !== policy.holidays.length || !policy.holidays.every((day) => typeof day === "string" && validDay(day))) return false;
  if (!policy.targets || typeof policy.targets !== "object") return false;
  return SLA_PRIORITIES.every((priority) => { const target = policy.targets[priority]; return !!target && Number.isInteger(target.response) && target.response > 0 && target.response <= 100000 && Number.isInteger(target.resolution) && target.resolution > 0 && target.resolution <= 100000 && target.resolution >= target.response; });
}

function workWindow(day: Date, policy: SlaPolicy): [number, number] | null {
  const year = day.getUTCFullYear(), month = day.getUTCMonth() + 1, date = day.getUTCDate();
  if (!policy.weekdays.includes(day.getUTCDay()) || policy.holidays.includes(isoDate(year, month, date))) return null;
  const [startHour, startMinute] = policy.start.split(":").map(Number), [endHour, endMinute] = policy.end.split(":").map(Number);
  return [localToUtc(year, month, date, startHour, startMinute).getTime(), localToUtc(year, month, date, endHour, endMinute).getTime()];
}
function localDay(instant: Date) { const local = parts(instant); return new Date(Date.UTC(local.year, local.month - 1, local.day)); }
function nextDay(day: Date) { day.setUTCDate(day.getUTCDate() + 1); }

export function workingMillisecondsBetween(start: Date, end: Date, policy: SlaPolicy): number {
  if (!isSlaPolicy(policy) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw new Error("بازه یا تنظیمات نامعتبر است.");
  const day = localDay(start), last = localDay(end).getTime(); let total = 0, iterations = 0;
  while (day.getTime() <= last) {
    if (++iterations > 36600) throw new Error("بازه زمانی بیش از حد طولانی است.");
    const window = workWindow(day, policy);
    if (window) total += Math.max(0, Math.min(end.getTime(), window[1]) - Math.max(start.getTime(), window[0]));
    nextDay(day);
  }
  return total;
}

export function addWorkingMinutes(start: Date, minutes: number, policy: SlaPolicy): Date {
  if (!isSlaPolicy(policy) || !Number.isFinite(start.getTime()) || !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 100000) throw new Error("زمان یا تنظیمات نامعتبر است.");
  return addWorkingMilliseconds(start,minutes*60000,policy);
}
export function addWorkingMilliseconds(start:Date,milliseconds:number,policy:SlaPolicy):Date {
  if (!isSlaPolicy(policy) || !Number.isFinite(start.getTime()) || !Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 6000000000) throw new Error("زمان یا تنظیمات نامعتبر است.");
  if (milliseconds === 0) return new Date(start);
  const day = localDay(start); let remaining = milliseconds, cursor = start.getTime();
  for (let i = 0; i < 36600; i++) {
    const window = workWindow(day, policy);
    if (window) { const from = Math.max(cursor, window[0]); const available = Math.max(0, window[1] - from); if (remaining <= available) return new Date(from + remaining); remaining -= available; }
    nextDay(day); cursor = 0;
  }
  throw new Error("یافتن زمان کاری ممکن نشد.");
}
