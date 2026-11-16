"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toJalali, toGregorian, jalaliMonthLength, jalaliMonths } from "@/lib/jalali";
import { eventsOfDay, isHoliday } from "@/lib/holidays";
import "@/styles/jalali.css";

const fa = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
const pad = (n: number) => String(n).padStart(2, "0");
const WD = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // هفته از شنبه شروع می‌شود
const iso = (g: { gy: number; gm: number; gd: number }) => `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
// شماره‌ی روز هفته با شنبه=۰ … جمعه=۶
const weekday = (jy: number, jm: number, jd: number) => { const g = toGregorian(jy, jm, jd); return (new Date(Date.UTC(g.gy, g.gm - 1, g.gd)).getUTCDay() + 1) % 7; };
const todayJ = () => { const d = new Date(); return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

/** انتخابگر تاریخ شمسی (تقویم بازشونده). مقدار بیرونی همیشه YYYY-MM-DD میلادی است. */
export function JalaliDateInput({ value, onChange, label, iconOnly }: { value?: string; onChange: (v?: string) => void; label: string; iconOnly?: boolean }) {
  const now = todayJ();
  const cur = value ? (() => { const [y, m, d] = value.split("-").map(Number); return toJalali(y, m, d); })() : undefined;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: cur?.jy ?? now.jy, m: cur?.jm ?? now.jm });
  const [hover, setHover] = useState<{ y: number; m: number; d: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 8, left: 8, maxHeight: 500 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const panel = popup.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const gap = 6, margin = 8;
      const below = window.innerHeight - anchor.bottom - gap - margin;
      const above = anchor.top - gap - margin;
      const naturalHeight = (popup.current?.scrollHeight ?? panel.height) + 2;
      const maxHeight = Math.max(0, window.innerHeight - margin * 2);
      const height = Math.min(naturalHeight, maxHeight);
      const top = below >= height ? anchor.bottom + gap : above >= height ? anchor.top - gap - height : Math.max(margin, Math.min(anchor.bottom + gap, window.innerHeight - height - margin));
      const left = Math.max(margin, Math.min(anchor.right - panel.width, window.innerWidth - panel.width - margin));
      const next = { top: Math.max(margin, top), left, maxHeight };
      setPosition(current => current.top === next.top && current.left === next.left && current.maxHeight === next.maxHeight ? current : next);
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (popup.current) observer?.observe(popup.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, view.y, view.m]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = () => { if (!open) setView({ y: cur?.jy ?? now.jy, m: cur?.jm ?? now.jm }); setOpen(!open); };
  const step = (n: number) => setView(({ y, m }) => { const t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; });
  const pick = (d: number) => { onChange(iso(toGregorian(view.y, view.m, d))); setOpen(false); };

  const lead = weekday(view.y, view.m, 1);
  const len = jalaliMonthLength(view.y, view.m);
  // بازه‌ی سال‌ها: از ۱۳۰۰ تا ۱۴۱۰ (و اگر سال فعلی بزرگ‌تر بود، تا همان سال)
  const maxYear = Math.max(1410, now.jy + 5);
  const years = Array.from({ length: maxYear - 1300 + 1 }, (_, i) => 1300 + i);
  if (!years.includes(view.y)) years.push(view.y);
  const info = hover ?? (cur && cur.jy === view.y && cur.jm === view.m ? { y: cur.jy, m: cur.jm, d: cur.jd } : null);
  const infoEv = info ? eventsOfDay(info.y, info.m, info.d) : [];

  return (
    <div className="jdp" ref={box} role="group" aria-label={label}>
      <button ref={trigger} type="button" className={"jdp-btn" + (iconOnly ? " icon" : "") + (cur ? "" : " empty")} aria-label={`انتخاب ${label}`} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <svg className="jdp-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
        {!iconOnly && <span>{cur ? `${fa(cur.jd)} ${jalaliMonths[cur.jm - 1]} ${fa(cur.jy)}` : "انتخاب تاریخ"}</span>}
      </button>
      {open && createPortal(
        <div ref={popup} className="jdp-pop" role="dialog" aria-label={label} style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}>
          <div className="jdp-head">
            <button type="button" className="jdp-nav" aria-label="ماه بعد" onClick={() => step(1)}>›</button>
            <select aria-label="ماه" value={view.m} onChange={(e) => setView({ ...view, m: Number(e.target.value) })}>
              {jalaliMonths.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
            <select aria-label="سال" value={view.y} onChange={(e) => setView({ ...view, y: Number(e.target.value) })}>
              {years.sort((a, b) => b - a).map((v) => <option key={v} value={v}>{fa(v)}</option>)}
            </select>
            <button type="button" className="jdp-nav" aria-label="ماه قبل" onClick={() => step(-1)}>‹</button>
          </div>
          <div className="jdp-grid">
            {WD.map((w, i) => <div key={w} className={"jdp-wd" + (i === 6 ? " fri" : "")}>{w}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={"e" + i} />)}
            {Array.from({ length: len }, (_, i) => {
              const d = i + 1, wd = (lead + i) % 7;
              const ev = eventsOfDay(view.y, view.m, d);
              const cls = ["jdp-day", isHoliday(view.y, view.m, d, wd) ? "hol" : "", ev.length ? "ev" : "",
                view.y === now.jy && view.m === now.jm && d === now.jd ? "today" : "",
                cur && cur.jy === view.y && cur.jm === view.m && cur.jd === d ? "sel" : ""].filter(Boolean).join(" ");
              return <button key={d} type="button" className={cls} aria-label={`${fa(d)} ${jalaliMonths[view.m - 1]} ${fa(view.y)}`} aria-pressed={!!(cur && cur.jy === view.y && cur.jm === view.m && cur.jd === d)} title={ev.map((e) => e.title).join("\n") || undefined}
                onMouseEnter={() => setHover({ y: view.y, m: view.m, d })} onMouseLeave={() => setHover(null)} onClick={() => pick(d)}>{fa(d)}</button>;
            })}
          </div>
          {infoEv.length > 0 && <div className="jdp-info">
            {infoEv.map((e, i) => <div key={i} className={e.holiday ? "hol" : ""}>{e.holiday ? "تعطیل: " : ""}{e.title}</div>)}
          </div>}
          <div className="jdp-foot">
            <button type="button" onClick={() => { onChange(iso(toGregorian(now.jy, now.jm, now.jd))); setOpen(false); }}>امروز</button>
            {cur && <button type="button" onClick={() => { onChange(undefined); setOpen(false); }}>پاک کردن</button>}
          </div>
        </div>, document.body
      )}
    </div>
  );
}
