import { mockWeather } from "./mock/weather";

export type WeatherCity = { id: string; name: string; lat: number; lon: number };
export const weatherCities: WeatherCity[] = [
  { id: "tehran", name: "تهران", lat: 35.69, lon: 51.42 },
  { id: "yazd", name: "یزد", lat: 31.9, lon: 54.37 },
  { id: "saghand", name: "ساغند", lat: 31.98, lon: 55.42 },
  { id: "kerman", name: "کرمان", lat: 30.28, lon: 57.08 },
  { id: "sirjan", name: "سیرجان", lat: 29.46, lon: 55.68 },
];

export type WeatherIconKind = "sun-cloud" | "cloud" | "rain" | "sun";
export type WeatherDay = { date: string; min: number; max: number; condition: string; icon: WeatherIconKind };
export type WeatherData = { temp: number; condition: string; icon: WeatherIconKind; forecast: WeatherDay[] };

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/** Mock mode: sample data. Otherwise: calls /api/weather (server proxy to Open-Meteo). */
export async function getWeather(city: WeatherCity): Promise<WeatherData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 150));
    return { ...(mockWeather[city.id] ?? mockWeather.tehran), forecast: [] };
  }
  const res = await fetch(`/api/weather?city=${encodeURIComponent(city.id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("اطلاعات آب‌وهوا در دسترس نیست.");
  return res.json();
}
