import { toJalali } from "@/lib/jalali";
export type CreditOrder = { id: string; code: string; ts?: number; total: number; excess: number; guest?: string; cancelled?: boolean };
export const cafeMonth = (ts: number) => { const d = new Date(ts), j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate()); return `${j.jy}-${j.jm}`; };
export function recalculateCafeCredit(orders: CreditOrder[], code: string, ts: number, cap: number) {
  let used = 0;
  for (const order of orders.filter(o => o.code === code && o.ts && cafeMonth(o.ts) === cafeMonth(ts) && !o.guest && !o.cancelled).sort((a,b) => a.ts! - b.ts! || a.id.localeCompare(b.id))) {
    order.excess = cap === Infinity ? 0 : Math.max(0, order.total - Math.max(0, cap - used));
    used += order.total - order.excess;
  }
}
