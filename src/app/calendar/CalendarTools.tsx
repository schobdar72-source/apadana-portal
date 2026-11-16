"use client";

import { useEffect, useState } from "react";
import { jalaliMonthLength, jalaliMonths, toGregorian, toJalali } from "@/lib/jalali";
import { prayerProvinces } from "@/lib/prayerCities";

type CalendarKind = "jalali" | "gregorian" | "islamic";
type TimingKey = "Fajr" | "Sunrise" | "Dhuhr" | "Sunset" | "Maghrib" | "Midnight";
type PrayerData = { date: string; city: string; timings: Record<TimingKey, string> };
const fields: [TimingKey, string][] = [["Fajr", "اذان صبح"], ["Sunrise", "طلوع خورشید"], ["Dhuhr", "اذان ظهر"], ["Sunset", "غروب خورشید"], ["Maghrib", "اذان مغرب"], ["Midnight", "نیمه‌شب شرعی"]];
const months = { jalali: jalaliMonths, gregorian: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], islamic: ["محرّم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوّال", "ذو القعدة", "ذو الحجة"] };
const islamicParts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
const formats = {
  jalali: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  gregorian: new Intl.DateTimeFormat("en-US-u-ca-gregory", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  islamic: new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
};
const numeric = (value: string) => value.replace(/[۰-۹٠-٩]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit) >= 0 ? "۰۱۲۳۴۵۶۷۸۹".indexOf(digit) : "٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const islamicKey = (date: Date) => { const parts = islamicParts.formatToParts(date); const read = (type: string) => Number(parts.find(part => part.type === type)?.value); return read("year") * 10000 + read("month") * 100 + read("day"); };
function convert(kind: CalendarKind, year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (kind === "jalali") {
    if (year < 1200 || year > 1600 || day > jalaliMonthLength(year, month)) return null;
    const gregorian = toGregorian(year, month, day);
    return new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd, 12));
  }
  if (kind === "gregorian") {
    if (year < 1821 || year > 2221) return null;
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return date.getUTCMonth() === month - 1 ? date : null;
  }
  if (year < 1235 || year > 1645) return null;
  const key = year * 10000 + month * 100 + day;
  let low = Math.floor(Date.UTC(1821, 0, 1, 12) / 86400000), high = Math.floor(Date.UTC(2221, 11, 31, 12) / 86400000);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2), date = new Date(middle * 86400000 + 43200000), current = islamicKey(date);
    if (current === key) return date;
    if (current < key) low = middle + 1; else high = middle - 1;
  }
  return null;
}

type JalaliDate = { jy: number; jm: number; jd: number };
export function CalendarTools({ today, selected, onToday }: { today: JalaliDate; selected: JalaliDate | null; onToday: () => void }) {
  const [province, setProvince] = useState("Tehran");
  const [city, setCity] = useState("تهران");
  const [activeDate, setActiveDate] = useState(today);
  const [prayer, setPrayer] = useState<PrayerData | null>(null);
  const [prayerStatus, setPrayerStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState<CalendarKind>("jalali");
  const [year, setYear] = useState(String(today.jy));
  const [month, setMonth] = useState(today.jm);
  const [day, setDay] = useState(String(today.jd));
  const [result, setResult] = useState<Date | null>(() => convert("jalali", today.jy, today.jm, today.jd));
  const [error, setError] = useState("");
  const activeGregorian = toGregorian(activeDate.jy, activeDate.jm, activeDate.jd);
  const dateString = `${activeGregorian.gy}-${String(activeGregorian.gm).padStart(2, "0")}-${String(activeGregorian.gd).padStart(2, "0")}`;
  const currentProvince = prayerProvinces.find(item => item.slug === province)!;
  useEffect(() => {
    if (!selected) return;
    setActiveDate({ jy: selected.jy, jm: selected.jm, jd: selected.jd });
    setKind("jalali"); setYear(String(selected.jy)); setMonth(selected.jm); setDay(String(selected.jd));
    setResult(convert("jalali", selected.jy, selected.jm, selected.jd)); setError("");
  }, [selected?.jy, selected?.jm, selected?.jd]);
  useEffect(() => {
    const controller = new AbortController(); setPrayer(null); setPrayerStatus("loading");
    const params = new URLSearchParams({ province, city, date: dateString });
    fetch(`/api/calendar/prayer-times?${params}`, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(data => { setPrayer(data); setPrayerStatus("ready"); }).catch(() => { if (!controller.signal.aborted) setPrayerStatus("error"); });
    return () => controller.abort();
  }, [province, city, dateString, retry]);
  const changeKind = (next: CalendarKind) => {
    setKind(next); setError(""); setResult(null);
    const gregorian = toGregorian(activeDate.jy, activeDate.jm, activeDate.jd), date = new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd, 12));
    if (next === "jalali") { setYear(String(activeDate.jy)); setMonth(activeDate.jm); setDay(String(activeDate.jd)); }
    else if (next === "gregorian") { setYear(String(gregorian.gy)); setMonth(gregorian.gm); setDay(String(gregorian.gd)); }
    else { const key = islamicKey(date); setYear(String(Math.floor(key / 10000))); setMonth(Math.floor(key / 100) % 100); setDay(String(key % 100)); }
  };
  const submit = (event: React.FormEvent) => { event.preventDefault(); const converted = convert(kind, Number(numeric(year)), month, Number(numeric(day))); if (!converted || !year.trim() || !day.trim()) { setResult(null); setError("تاریخ واردشده معتبر نیست یا خارج از محدوده پشتیبانی است."); return; } setResult(converted); setError(""); };
  const resetToday = () => { setActiveDate(today); setKind("jalali"); setYear(String(today.jy)); setMonth(today.jm); setDay(String(today.jd)); setResult(convert("jalali", today.jy, today.jm, today.jd)); setError(""); onToday(); };
  const solar = result ? toJalali(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate()) : null;
  const age = solar ? today.jy - solar.jy - (today.jm < solar.jm || (today.jm === solar.jm && today.jd < solar.jd) ? 1 : 0) : null;
  return <div className="oc-tools">
    <section className="oc-tool oc-prayer"><div className="oc-tool-heading"><div><h2>اوقات شرعی به افق شهرها</h2><p>برای روز انتخاب‌شده، بر اساس روش مؤسسه ژئوفیزیک دانشگاه تهران</p></div><div className="oc-prayer-controls"><label>استان<select value={province} onChange={event => { const next = prayerProvinces.find(item => item.slug === event.target.value)!; setProvince(next.slug); setCity(next.cities[0].name); }}>{prayerProvinces.map(item => <option key={item.slug} value={item.slug}>{item.province}</option>)}</select></label><label>شهر<select value={city} onChange={event => setCity(event.target.value)}>{currentProvince.cities.map((item, index) => <option key={`${item.name}-${index}`} value={item.name}>{item.name}</option>)}</select></label><button type="button" onClick={resetToday}>امروز</button></div></div>
      {prayerStatus === "loading" ? <p role="status">در حال دریافت اوقات شرعی…</p> : prayerStatus === "error" ? <p role="alert">دریافت اوقات شرعی ممکن نشد. <button type="button" onClick={() => setRetry(value => value + 1)}>تلاش دوباره</button></p> : prayer && <><div className="oc-prayer-times">{fields.map(([key, label]) => <div key={key}><span>{label}</span><strong dir="ltr">{prayer.timings[key]}</strong></div>)}</div><p className="oc-tool-note">افق {prayer.city} · تاریخ {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${prayer.date}T12:00:00Z`))} · منبع: AlAdhan</p></>}
    </section>
    <section className="oc-tool oc-converter"><div className="oc-tool-heading"><div><h2>تبدیل تاریخ شمسی، میلادی و قمری</h2><p>تاریخ مورد نظر را وارد و تبدیل کنید.</p></div></div><form className="oc-convert-form" onSubmit={submit}><label>نوع تاریخ<select value={kind} onChange={event => changeKind(event.target.value as CalendarKind)}><option value="jalali">شمسی</option><option value="gregorian">میلادی</option><option value="islamic">قمری (ام‌القری)</option></select></label><label>روز<input inputMode="numeric" value={day} onChange={event => { setDay(event.target.value); setResult(null); setError(""); }} /></label><label>ماه<select value={month} onChange={event => { setMonth(Number(event.target.value)); setResult(null); setError(""); }}>{months[kind].map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label>سال<input inputMode="numeric" value={year} onChange={event => { setYear(event.target.value); setResult(null); setError(""); }} /></label><button type="submit">تبدیل تاریخ</button><button type="button" className="oc-today-button" onClick={resetToday}>امروز</button></form>{error && <p role="alert" className="oc-tool-error">{error}</p>}{result && solar && <><div className="oc-convert-result"><div><b>تاریخ شمسی</b><span>{formats.jalali.format(result)}</span></div><div><b>تاریخ میلادی</b><span data-preserve-digits lang="en" dir="ltr">{formats.gregorian.format(result)}</span></div><div><b>تاریخ قمری</b><span lang="ar">{formats.islamic.format(result)}</span></div></div><p className="oc-tool-note">{age !== null && age >= 0 ? `سن در صورت تاریخ تولد بودن: ${age.toLocaleString("fa-IR")} سال کامل` : "تاریخ انتخاب‌شده در آینده است."}</p></>}<p className="oc-tool-note">تاریخ قمری بر اساس ام‌القری است و ممکن است با تقویم رسمی ایران متفاوت باشد.</p></section>
  </div>;
}
