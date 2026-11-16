import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { toJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

// The public home page only needs today's dishes, not the complete cafe menu.
export async function GET() {
  try {
    const menu = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "cafe-menu.json"), "utf8"));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
    const [year, month, day] = today.split("-").map(Number);
    const jalaliDay = toJalali(year, month, day).jd;
    const weekday = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", weekday: "long" }).format(new Date());
    const entry = Array.isArray(menu.week) ? menu.week.find((item: { iso?: string; date?: string; day?: string }) => {
      if (item.iso) return item.iso === today;
      const date = String(item.date || "").replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
      return parseInt(date, 10) === jalaliDay && item.day === weekday;
    }) : undefined;
    return NextResponse.json({ off: !!entry?.off, meals: entry?.off ? [] : [entry?.lunch, entry?.lunch2].filter((v): v is string => typeof v === "string" && !!v.trim()) });
  } catch {
    return NextResponse.json({ error: "برنامه غذایی در دسترس نیست." }, { status: 503 });
  }
}
