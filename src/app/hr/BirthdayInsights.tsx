"use client";
import { useState } from "react";
import { Card } from "@/components/ui";
import { jalaliMonthLength, jalaliMonths, toGregorian } from "@/lib/jalali";

export type BirthdayInsightsData = {
  today: { jy: number; jm: number; jd: number };
  counts: { today: number; week: number; missingLocation: number; missingBirthDate: number };
  birthdays: { id: number; name: string; unit: string; locationId: number | null; location: string; month: number; day: number }[];
  incomplete: { id: number; name: string; unit: string; location: string; missingBirthDate: boolean; missingLocation: boolean }[];
};

export default function BirthdayInsights({ data, query, unit, location }: { data: BirthdayInsightsData; query: string; unit: string; location: string }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [daySelected, setDaySelected] = useState<number | null>(null);
  const monthIndex = data.today.jy * 12 + data.today.jm - 1 + monthOffset;
  const year = Math.floor(monthIndex / 12), month = ((monthIndex % 12) + 12) % 12 + 1;
  const length = jalaliMonthLength(year, month);
  const first = toGregorian(year, month, 1);
  const start = (new Date(Date.UTC(first.gy, first.gm - 1, first.gd)).getUTCDay() + 1) % 7;
  const matching = data.birthdays.filter(b => (!query.trim() || `${b.name} ${b.unit} ${b.location}`.toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa"))) && (!unit || b.unit === unit) && (!location || String(b.locationId ?? "missing") === location) && b.month === month);
  const byDay = (day: number) => matching.filter(b => Math.min(b.day, length) === day);
  const selected = daySelected ? byDay(daySelected) : [];
  const fa = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
  const move = (amount: number) => { setMonthOffset(v => v + amount); setDaySelected(null); };
  return <div className="pp-insights">
    <Card title="تقویم ماهانه تولدها">
      <p className="pp-hint">تولدهای کل سازمان در ماه انتخابی؛ جست‌وجو و فیلتر واحد و محل خدمت فهرست روی تقویم هم اعمال می‌شود. این نما به بازه کارت پرتال محدود نیست.</p>
      <div className="pp-calendar-nav"><button type="button" onClick={() => move(-1)} aria-label="ماه قبل">›</button><strong>{jalaliMonths[month - 1]} {fa(year)}</strong><button type="button" onClick={() => move(1)} aria-label="ماه بعد">‹</button><button type="button" onClick={() => { setMonthOffset(0); setDaySelected(null); }}>ماه جاری</button></div>
      <div className="pp-calendar" role="group" aria-label={`تقویم تولد ${jalaliMonths[month - 1]} ${fa(year)}`}>
        {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((name, i) => <span className="pp-calendar-weekday" key={i}>{name}</span>)}
        {Array.from({ length: start }, (_, i) => <span key={`empty-${i}`} />)}
        {Array.from({ length }, (_, i) => { const day = i + 1, count = byDay(day).length; return <button type="button" key={day} className={`${daySelected === day ? "selected " : ""}${year === data.today.jy && month === data.today.jm && day === data.today.jd ? "today" : ""}`} aria-label={`${fa(day)} ${jalaliMonths[month - 1]}، ${fa(count)} تولد`} aria-pressed={daySelected === day} onClick={() => setDaySelected(day)}><span>{fa(day)}</span>{count > 0 && <small>{fa(count)} تولد</small>}</button>; })}
      </div>
      {daySelected ? <div className="pp-calendar-results"><strong>{fa(daySelected)} {jalaliMonths[month - 1]}</strong>{selected.length ? selected.map(b => <a key={b.id} href={`/hr/employees?open=${b.id}`}>{b.name} <small>{[b.unit, b.location].filter(Boolean).join(" · ")}</small></a>) : <p>تولدی با فیلترهای فعلی در این روز ثبت نشده است.</p>}</div> : <p className="pp-hint">برای دیدن نام همکاران، یک روز را انتخاب کنید.</p>}
    </Card>
    <Card title="اطلاعات نیازمند تکمیل">
      <p className="pp-hint">کارکنان فعال کل سازمان، مستقل از بازه نمایش تولد. تاریخ نامعتبر نیز نیازمند اصلاح است.</p>
      {data.incomplete.length ? <div className="pp-incomplete">{data.incomplete.map(e => <a key={e.id} href={`/hr/employees?open=${e.id}`}><strong>{e.name}</strong><span>{[e.unit, e.missingBirthDate ? "تاریخ تولد ثبت نشده یا نامعتبر" : "", e.missingLocation ? "محل خدمت ثبت نشده" : ""].filter(Boolean).join(" · ")}</span></a>)}</div> : <p className="pp-hint">تاریخ تولد و محل خدمت همه کارکنان فعال ثبت شده است.</p>}
    </Card>
  </div>;
}
