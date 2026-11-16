"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PortalIcon } from "@/components/PortalIcon";
import { eventsOfDay, hasYearData, dataUpdated } from "@/lib/holidays";
import { jalaliMonthLength, jalaliMonths, toGregorian, toJalali } from "@/lib/jalali";
import { useCalEvents } from "@/services/portalData";
import { CalendarTools } from "./CalendarTools";
import "@/styles/organizational-calendar.css";

const fa = (value: number) => value.toLocaleString("fa-IR", { useGrouping: false });
const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const gregorianFull = new Intl.DateTimeFormat("en-US-u-ca-gregory", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const islamicFull = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const gregorianDay = new Intl.DateTimeFormat("en-US-u-ca-gregory", { day: "numeric", timeZone: "UTC" });
const islamicDay = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { day: "numeric", timeZone: "UTC" });
const normalize = (text: string) => text.toLocaleLowerCase("fa").replace(/[يى]/g, "ی").replace(/ك/g, "ک").trim();
const isoDate = (year: number, month: number, day: number) => {
  const date = toGregorian(year, month, day);
  return `${date.gy}-${String(date.gm).padStart(2, "0")}-${String(date.gd).padStart(2, "0")}`;
};
const dateAtNoon = (year: number, month: number, day: number) => new Date(`${isoDate(year, month, day)}T12:00:00Z`);
const weekdayOf = (year: number, month: number, day: number) => (dateAtNoon(year, month, day).getUTCDay() + 1) % 7;
const todayJalali = () => {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  return toJalali(year, month, day);
};

export default function CalendarPage() {
  const [today, setToday] = useState<{ jy: number; jm: number; jd: number } | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ month: number; day: number } | null>(null);
  const [month, setMonth] = useState(1);
  const [query, setQuery] = useState("");
  const [holidaysOnly, setHolidaysOnly] = useState(false);
  const customEvents = useCalEvents(true, false);
  useEffect(() => { const date = todayJalali(); setToday(date); setYear(date.jy); setMonth(date.jm); setSelected({ month: date.jm, day: date.jd }); }, []);
  if (year === null || !today) return <AppShell title="تقویم سازمانی" activeHref="/calendar"><p>در حال دریافت تقویم...</p></AppShell>;
  const dayEvents = (month: number, day: number) => {
    const official = eventsOfDay(year, month, day).map(event => ({ title: event.title, holiday: event.holiday, source: "مناسبت رسمی", kind: "official" }));
    const personal = customEvents.filter(event => event.date === isoDate(year, month, day)).map(event => ({ title: event.title, holiday: event.holiday, source: "رویداد سازمانی", kind: "organization" }));
    return [...official, ...personal];
  };
  const isHoliday = (eventMonth: number, day: number) => weekdayOf(year, eventMonth, day) === 6 || dayEvents(eventMonth, day).some(event => event.holiday);
  const searchActive = normalize(query).length > 0 || holidaysOnly;
  const listedMonths = searchActive ? Array.from({ length: 12 }, (_, index) => index + 1) : [month];
  const listed = listedMonths.flatMap(eventMonth => Array.from({ length: jalaliMonthLength(year, eventMonth) }, (_, index) => index + 1).flatMap(day => dayEvents(eventMonth, day).filter(event => (!holidaysOnly || event.holiday) && normalize(event.title).includes(normalize(query))).map(event => ({ ...event, month: eventMonth, day }))));
  const selectedEvents = selected ? dayEvents(selected.month, selected.day) : [];
  const selectedDate = selected ? dateAtNoon(year, selected.month, selected.day) : null;
  const changeYear = (value: number) => { setYear(value); setSelected(null); };
  const moveMonth = (direction: number) => {
    if ((year === 1200 && month === 1 && direction < 0) || (year === 1600 && month === 12 && direction > 0)) return;
    if (month + direction < 1) { setYear(year - 1); setMonth(12); }
    else if (month + direction > 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + direction);
    setSelected(null);
  };
  const first = toGregorian(year, month, 1);
  const offset = (new Date(Date.UTC(first.gy, first.gm - 1, first.gd)).getUTCDay() + 1) % 7;
  return <AppShell title="تقویم سازمانی" activeHref="/calendar">
    <div className="org-calendar" dir="rtl">
      <header className="oc-head"><div><h1><PortalIcon name="calendar" size={25} /> تقویم سازمانی</h1><p>تقویم و مناسبت‌های سازمان</p></div><div className="oc-year"><button type="button" disabled={year <= 1200} onClick={() => changeYear(year - 1)} aria-label="سال قبل">›</button><strong>{fa(year)}</strong><button type="button" disabled={year >= 1600} onClick={() => changeYear(year + 1)} aria-label="سال بعد">‹</button><button type="button" onClick={() => { setYear(today.jy); setMonth(today.jm); setSelected({ month: today.jm, day: today.jd }); }}>امروز</button></div></header>
      {!hasYearData(year) && <p className="oc-notice">مناسبت‌های رسمی سال {fa(year)} هنوز در پرتال به‌روزرسانی نشده‌اند؛ رویدادهای سازمانی ثبت‌شده نمایش داده می‌شوند.</p>}
      <nav className="oc-month-nav" aria-label="انتخاب ماه">{jalaliMonths.map((name, index) => <button type="button" key={name} className={month === index + 1 ? "active" : ""} aria-pressed={month === index + 1} onClick={() => { setMonth(index + 1); setSelected(null); }}>{name}</button>)}</nav>
      <div className="oc-layout"><section className="oc-months" aria-label={`تقویم ${jalaliMonths[month - 1]} ${fa(year)}`}>
          <article className="oc-month"><div className="oc-month-heading"><button type="button" disabled={year === 1200 && month === 1} onClick={() => moveMonth(-1)} aria-label="ماه قبل">›</button><h2>{jalaliMonths[month - 1]} {fa(year)}</h2><button type="button" disabled={year === 1600 && month === 12} onClick={() => moveMonth(1)} aria-label="ماه بعد">‹</button></div><div className="oc-grid">{weekdays.map((weekday, weekdayIndex) => <span className="oc-weekday" key={weekdayIndex}><span className="oc-weekday-full">{weekday}</span><span className="oc-weekday-short">{weekday[0]}</span></span>)}{Array.from({ length: offset }, (_, emptyIndex) => <span key={`empty-${emptyIndex}`} />)}{Array.from({ length: jalaliMonthLength(year, month) }, (_, dayIndex) => {
            const day = dayIndex + 1; const events = dayEvents(month, day); const friday = (offset + dayIndex) % 7 === 6; const active = selected?.month === month && selected.day === day; const isToday = today.jy === year && today.jm === month && today.jd === day;
            const holiday = friday || events.some(event => event.holiday); const date = dateAtNoon(year, month, day);
            return <button type="button" key={day} className={[holiday ? "holiday" : "", active ? "selected" : "", isToday ? "today" : "", events.length ? "has-event" : ""].filter(Boolean).join(" ")} aria-label={`${fa(day)} ${jalaliMonths[month - 1]} ${fa(year)}${holiday ? "، تعطیل" : ""}${events.length ? `، ${fa(events.length)} مناسبت` : ""}`} aria-pressed={active} onClick={() => setSelected({ month, day })}><span className="oc-day-top"><span>{fa(day)}</span>{holiday && <span className="oc-holiday-mark" aria-hidden="true">تعطیل</span>}</span><span className="oc-other-days"><span title="روز میلادی">م <span data-preserve-digits dir="ltr">{gregorianDay.format(date)}</span></span><span title="روز قمری">ق {islamicDay.format(date)}</span></span>{events.length > 0 && <small>{events.map(event => event.title).join("، ")}</small>}</button>;
          })}</div><p className="oc-calendar-legend">م: میلادی · ق: قمری (ام‌القری؛ ممکن است با تقویم رسمی ایران متفاوت باشد)</p></article>
      </section><aside className="oc-side"><section className="oc-panel"><h2>روز انتخاب‌شده</h2>{selected && selectedDate ? <><div className="oc-selected-title"><strong>{weekdays[weekdayOf(year, selected.month, selected.day)]} {fa(selected.day)} {jalaliMonths[selected.month - 1]} {fa(year)}</strong>{isHoliday(selected.month, selected.day) && <span className="oc-holiday-badge">تعطیل</span>}</div><div className="oc-selected-dates"><p><span>میلادی</span><span data-preserve-digits dir="ltr" lang="en">{gregorianFull.format(selectedDate)}</span></p><p><span>قمری (ام‌القری)</span><span lang="ar">{islamicFull.format(selectedDate)}</span></p></div>{selectedEvents.length ? <ul>{selectedEvents.map((event, index) => <li key={index}><span>{event.title}</span><small><span className={`oc-kind ${event.kind}`}>{event.source}</span>{event.holiday && <span className="oc-holiday-badge">تعطیل</span>}</small></li>)}</ul> : <p>مناسبتی برای این روز ثبت نشده است.</p>}</> : <p>برای دیدن مناسبت‌ها یک روز را انتخاب کنید.</p>}</section>
      <section className="oc-panel oc-events"><div className="oc-events-head"><h2>{searchActive ? `مناسبت‌های سال ${fa(year)}` : `مناسبت‌های ${jalaliMonths[month - 1]}`}</h2></div><div className="oc-filters"><label><span className="oc-sr-only">جست‌وجو در مناسبت‌های سال</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجو در مناسبت‌های سال" /></label><label className="oc-check"><input type="checkbox" checked={holidaysOnly} onChange={event => setHolidaysOnly(event.target.checked)} /> فقط تعطیلات ثبت‌شده</label></div>{listed.length ? <ul>{listed.map((event, index) => <li key={index} className={isHoliday(event.month, event.day) ? "oc-event-holiday" : undefined}><button type="button" onClick={() => { setMonth(event.month); setSelected({ month: event.month, day: event.day }); }}><b>{fa(event.day)} {jalaliMonths[event.month - 1]}</b><span>{event.title}</span><small><span className={`oc-kind ${event.kind}`}>{event.source}</span>{event.holiday && <span className="oc-holiday-badge">تعطیل</span>}</small></button></li>)}</ul> : <p>{searchActive ? "مناسبتی با فیلترهای انتخاب‌شده پیدا نشد." : "مناسبتی برای نمایش وجود ندارد."}</p>}<small className="oc-source">{hasYearData(year) ? `منبع مناسبت‌های رسمی: time.ir · آخرین به‌روزرسانی: ${dataUpdated(year)}` : "داده مناسبت‌های رسمی برای این سال موجود نیست."}</small></section></aside></div>
      <CalendarTools today={today} selected={selected ? { jy: year, jm: selected.month, jd: selected.day } : null} onToday={() => { const current = todayJalali(); setToday(current); setYear(current.jy); setMonth(current.jm); setSelected({ month: current.jm, day: current.jd }); }} />
    </div>
  </AppShell>;
}
