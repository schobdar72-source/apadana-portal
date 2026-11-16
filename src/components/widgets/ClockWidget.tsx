"use client";
import { useEffect, useState } from "react";

const tz = "Asia/Tehran";
const toFa = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

export function ClockWidget({ showDate = true }: { showDate?: boolean } = {}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now ? toFa(new Intl.DateTimeFormat("fa-IR", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)) : "--:--:--";
  const date = now ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now) : "";
  return (
    <div className="wd wd-clock">
      <svg className="wd-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      <div>
        <div className="wd-time" dir="ltr"><span>{time.slice(0, -3)}</span><span className="wd-seconds">{time.slice(-3)}</span></div>
        {showDate && <div className="wd-sub">{date}</div>}
      </div>
    </div>
  );
}
