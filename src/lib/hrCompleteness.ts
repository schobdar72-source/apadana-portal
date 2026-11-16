import { jalaliMonthLength } from "./jalali";

export function validBirthDate(value: string | null | undefined): boolean {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value || "");
  if (!m) return false;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  return year >= 1200 && year <= 1600 && month >= 1 && month <= 12 && day >= 1 && day <= jalaliMonthLength(year, month);
}
