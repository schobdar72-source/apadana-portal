import { NextRequest, NextResponse } from "next/server";

// Server-side proxy to Open-Meteo (no API key). Cached for 10 minutes.
const CITIES: Record<string, { lat: number; lon: number }> = {
  tehran: { lat: 35.69, lon: 51.42 },
  kerman: { lat: 30.28, lon: 57.08 },
  yazd: { lat: 31.9, lon: 54.37 },
  saghand: { lat: 31.98, lon: 55.42 },
  sirjan: { lat: 29.46, lon: 55.68 },
};

// WMO weather codes -> icon kind and Persian label
function describe(code: number): { icon: "sun" | "sun-cloud" | "cloud" | "rain"; condition: string } {
  if (code === 0) return { icon: "sun", condition: "آفتابی" };
  if (code <= 2) return { icon: "sun-cloud", condition: "نیمه ابری" };
  if (code === 3) return { icon: "cloud", condition: "ابری" };
  if (code === 45 || code === 48) return { icon: "cloud", condition: "مه" };
  if (code >= 51 && code <= 99) return { icon: "rain", condition: "بارانی" };
  return { icon: "cloud", condition: "نامشخص" };
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("city") ?? "tehran";
  const city = CITIES[id];
  if (!city) return NextResponse.json({ error: "unknown city" }, { status: 400 });

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=Asia%2FTehran`;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const json = await res.json();
    const d = describe(json.current.weather_code);
    const daily = json.daily;
    if (!daily || !Array.isArray(daily.time) || daily.time.length < 4 ||
      ![daily.weather_code, daily.temperature_2m_max, daily.temperature_2m_min].every((v: unknown) => Array.isArray(v) && v.length >= 4)) throw new Error("invalid forecast");
    const forecast = daily.time.slice(1, 4).map((date: string, index: number) => {
      const i = index + 1;
      return { date, min: Math.round(daily.temperature_2m_min[i]), max: Math.round(daily.temperature_2m_max[i]), ...describe(daily.weather_code[i]) };
    });
    return NextResponse.json({ temp: Math.round(json.current.temperature_2m), ...d, forecast });
  } catch {
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }
}
