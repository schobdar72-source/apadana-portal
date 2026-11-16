"use client";
import { useEffect, useState } from "react";
import type { ExternalNewsConfig } from "@/config/pages";

type Headline = { title: string; url: string; publishedAt: string | null; category: string; source: "irna" | "mehr" | "darsotoon" };
type Feed = { items: Headline[]; updatedAt: string; stale: boolean };

export function ExternalNews({ config }: { config: ExternalNewsConfig }) {
  const [feed, setFeed] = useState<{ source: string; data: Feed } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const data = feed?.source === config.source ? feed.data : null;
  const items = data?.items.slice(0, config.count) ?? [];
  useEffect(() => { setIndex(0); }, [config.source]);
  useEffect(() => {
    if (!config.enabled || items.length < 2 || paused || hovered || focused || reducedMotion) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [config.enabled, items.length, paused, hovered, focused, reducedMotion]);
  useEffect(() => {
    if (!config.enabled) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/portal/external-news?source=${config.source}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data: Feed = await response.json();
        if (active) { setFeed({ source: config.source, data }); setError(false); }
      } catch { if (active) setError(true); }
    };
    setError(false); void load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [config.source, config.enabled, retry]);
  if (!config.enabled) return null;
  const current = items.length ? items[index % items.length] : null;
  const sourceName = config.source === "irna" ? "ایرنا" : config.source === "mehr" ? "مهر" : "درستون";
  const format = (date: string) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  return <section className="hp-external-news" aria-labelledby="external-news-title">
    <div className="hp-external-head"><div><span className="hp-external-icon" aria-hidden="true">◉</span><h2 id="external-news-title">خبرهای روز</h2></div><small>تیترها از {sourceName}</small></div>
    {current ? <div className="hp-external-slide"><span className="hp-external-category">{current.category} · {current.source === "irna" ? "ایرنا" : current.source === "mehr" ? "مهر" : "درستون"}</span><a href={current.url} target="_blank" rel="noopener noreferrer" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>{current.title}<span aria-hidden="true"> ↗</span></a>{current.publishedAt && <time dateTime={current.publishedAt}>{format(current.publishedAt)}</time>}</div> : <p className="hp-external-message">{error ? "دریافت خبرها در حال حاضر امکان‌پذیر نیست." : "در حال دریافت خبرها…"}</p>}
    <div className="hp-external-bottom"><div className="hp-external-meta">{data && <span>{data.stale || error ? "آخرین دریافت (به‌روزرسانی ناموفق): " : "آخرین دریافت: "}{format(data.updatedAt)}</span>}{(error || data?.stale) && <button type="button" onClick={() => setRetry(n => n + 1)}>تلاش دوباره</button>}</div>
      {items.length > 1 && <div className="hp-external-controls" aria-label="کنترل خبرها"><button type="button" onClick={() => setIndex(n => (n - 1 + items.length) % items.length)} aria-label="خبر قبلی">‹</button><span>{(index % items.length + 1).toLocaleString("fa-IR")} / {items.length.toLocaleString("fa-IR")}</span><button type="button" onClick={() => setIndex(n => (n + 1) % items.length)} aria-label="خبر بعدی">›</button>{!reducedMotion && <button type="button" className="hp-external-pause" onClick={() => setPaused(p => !p)}>{paused ? "پخش خبرها" : "توقف خبرها"}</button>}</div>}
    </div>
  </section>;
}
