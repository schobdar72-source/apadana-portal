import { NextRequest, NextResponse } from "next/server";
import { findPrayerCity } from "@/lib/prayerCities";

export async function GET(request: NextRequest) {
  const city = findPrayerCity(request.nextUrl.searchParams.get("province") || "", request.nextUrl.searchParams.get("city") || "");
  if (!city) return NextResponse.json({ error: "شهر انتخاب‌شده معتبر نیست." }, { status: 400 });
  const date = request.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "تاریخ معتبر نیست." }, { status: 400 });
  const [year, month, day] = date.split("-");
  const checked = new Date(`${date}T12:00:00Z`);
  if (Number(year) < 1821 || Number(year) > 2222 || Number.isNaN(checked.getTime()) || checked.toISOString().slice(0, 10) !== date) return NextResponse.json({ error: "تاریخ معتبر نیست." }, { status: 400 });
  const url = new URL(`https://api.aladhan.com/v1/timings/${day}-${month}-${year}`);
  url.search = new URLSearchParams({ latitude: String(city.latitude), longitude: String(city.longitude), method: "7", midnightMode: "1", timezonestring: "Asia/Tehran" }).toString();
  try {
    const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Prayer service unavailable");
    const data = await response.json();
    const timings = data?.data?.timings;
    const keys = ["Fajr", "Sunrise", "Dhuhr", "Sunset", "Maghrib", "Midnight"] as const;
    if (!keys.every(key => typeof timings?.[key] === "string" && /^\d{2}:\d{2}/.test(timings[key]))) throw new Error("Invalid prayer times");
    return NextResponse.json({ date, city: city.name, timings: Object.fromEntries(keys.map(key => [key, timings[key].slice(0, 5)])) });
  } catch {
    return NextResponse.json({ error: "دریافت اوقات شرعی ممکن نیست. دوباره تلاش کنید." }, { status: 502 });
  }
}
