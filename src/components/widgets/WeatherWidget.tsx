"use client";
import { useEffect, useRef, useState } from "react";
import { getWeather, weatherCities, WeatherData } from "@/services/weather";

const toFa = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const storageKey = "apadana.weather.city";

function WeatherIcon({ kind }: { kind: WeatherData["icon"] }) {
  const sun = <circle cx="9" cy="9" r="4.5" fill="#FFC52E"/>;
  const cloud = <path d="M7 19a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17.5 19Z" fill="#fff" stroke="#9AA0A6" strokeWidth="1"/>;
  return <svg className="wd-wx" viewBox="0 0 28 28" aria-hidden="true">
    {kind === "sun" && sun}{kind === "sun-cloud" && <>{sun}{cloud}</>}{kind === "cloud" && cloud}
    {kind === "rain" && <>{cloud}<path d="M9 21l-1 3M14 21l-1 3M19 21l-1 3" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/></>}
  </svg>;
}

export function WeatherWidget({ fixedCity }: { fixedCity?: string } = {}) {
  const [cityId, setCityId] = useState<string | null>(null);
  const [result, setResult] = useState<{ city: string; data: WeatherData; updated: Date } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [panel, setPanel] = useState<"city" | "forecast" | null>(null);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const cityButton = useRef<HTMLButtonElement>(null);
  const forecastButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* storage may be unavailable */ }
    setCityId(fixedCity && weatherCities.some(c => c.id === fixedCity) ? fixedCity : weatherCities.some(c => c.id === saved) ? saved : weatherCities[0].id);
  }, [fixedCity]);

  useEffect(() => {
    if (!panel) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setPanel(null); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPanel(null); (panel === "city" ? cityButton : forecastButton).current?.focus(); }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [panel]);

  useEffect(() => {
    if (!cityId) return;
    const city = weatherCities.find(c => c.id === cityId)!;
    let active = true;
    setError(false);
    const load = () => getWeather(city).then(data => {
      if (active) { setResult({ city: city.id, data, updated: new Date() }); setError(false); }
    }).catch(() => { if (active) setError(true); });
    load();
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [cityId, retry]);

  const city = weatherCities.find(c => c.id === cityId) ?? weatherCities[0];
  const data = result?.city === cityId ? result : null;
  const filtered = weatherCities.filter(c => c.name.includes(query.trim()));
  return <div className={"wd wd-weather" + (panel ? " is-open" : "")} ref={ref}>
    <button ref={forecastButton} type="button" className="wd-current" aria-expanded={panel === "forecast"} aria-label={`آب‌وهوای ${city.name} و پیش‌بینی سه روز آینده`} onClick={() => setPanel(p => p === "forecast" ? null : "forecast")}>
      {data ? <><WeatherIcon kind={data.data.icon}/><span><span className="wd-time">{toFa(String(data.data.temp))}°C</span><span className="wd-sub">{error ? "آخرین اطلاعات دریافت‌شده" : data.data.condition}</span></span></> : <span className="wd-sub">{error ? "آب‌وهوا در دسترس نیست" : "در حال دریافت آب‌وهوا…"}</span>}
    </button>
    <div className="wd-cityWrap">
      {fixedCity ? <span className="wd-city wd-city-fixed">{city.name}</span> : <button ref={cityButton} type="button" className="wd-city" aria-expanded={panel === "city"} aria-label="انتخاب شهر" onClick={() => { setPanel(p => p === "city" ? null : "city"); setQuery(""); }}>{city.name} <span className="wd-chev">▾</span></button>}
      {panel === "city" && <div className="wd-menu">
        <input className="wd-search" type="search" placeholder="جست‌وجوی شهر…" value={query} autoFocus onChange={e => setQuery(e.target.value)} aria-label="جست‌وجوی شهر" />
        {filtered.map(c => <button key={c.id} type="button" className={c.id === cityId ? "is-on" : ""} onClick={() => { setCityId(c.id); try { localStorage.setItem(storageKey, c.id); } catch { /* selection remains active for this session */ } setPanel(null); cityButton.current?.focus(); }}>{c.name}</button>)}
        {!filtered.length && <div className="wd-empty">شهری پیدا نشد</div>}
      </div>}
    </div>
    {panel === "forecast" && <div className="wd-forecast">
      <div className="wd-forecast-title"><strong>پیش‌بینی سه روز آینده</strong><span>{city.name}</span></div>
      {data && error && <p className="wd-forecast-note">آخرین دریافت: {new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(data.updated)}؛ به‌روزرسانی ناموفق بود.</p>}
      {data?.data.forecast?.length ? data.data.forecast.map(day => <div className="wd-forecast-day" key={day.date}>
        <span>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long" }).format(new Date(day.date + "T12:00:00+03:30"))}</span>
        <WeatherIcon kind={day.icon}/><span>{day.condition}</span><strong dir="ltr">{toFa(String(day.max))}° / {toFa(String(day.min))}°</strong>
      </div>) : <p className="wd-forecast-note">{error ? "دریافت اطلاعات ممکن نشد." : data ? "پیش‌بینی در دسترس نیست." : "در حال دریافت اطلاعات…"}</p>}
      {error && <button className="wd-retry" type="button" onClick={() => setRetry(n => n + 1)}>تلاش دوباره</button>}
      <div className="wd-forecast-source">دما: بیشینه / کمینه · منبع: Open-Meteo</div>
    </div>}
  </div>;
}
