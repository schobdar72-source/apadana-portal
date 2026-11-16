"use client";
import { useEffect, useState } from "react";
import { useMe } from "@/services/useMe";
import Link from "next/link";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { useAnnouncements, isShown, sortAnnouncements } from "@/services/lobbyNews";
import { PortalIcon } from "@/components/PortalIcon";
import { useTiles, useCards, type CardCfg, useCalEvents } from "@/services/portalData";
import { useSharedPortalStore } from "@/services/sharedPortalStore";
import { pageDef, externalNewsConfig } from "@/config/pages";
import { ExternalNews } from "@/components/ExternalNews";
import { UserMenu } from "@/components/layout/UserMenu";
import { roleLabel } from "@/services/useMe";
import { safePortalLink } from "@/lib/portalLink";
import { defaultHomeSlides, validHomeSlides, type HomeSlide } from "@/config/homeSlides";

// صفحه‌ی اصلی پرتال پس از تأیید نشست نمایش داده می‌شود.
function Hero({ slides }: { slides: HomeSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || reducedMotion || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, reducedMotion, slides.length]);
  const go = (n: number) => setI((i + n + slides.length) % slides.length);
  const current = slides[i % slides.length];
  return (
    <section className={"hp-hero" + (current.style === "artwork" ? " hp-hero-artwork" : current.style === "dark" ? " hp-hero-dark" : "")} aria-label="تصاویر معرفی شرکت" style={{ backgroundImage: `url(${JSON.stringify(current.image)})` }}>
      <div className="hp-hero-shade" />
      <div className="hp-hero-copy">
        <span>به پرتال آپادانا کاوش ایرانیان</span>
        <h1>خوش <em>آمدید</em></h1>
        <p>دسترسی یکپارچه به خدمات و سامانه‌های سازمان</p>
      </div>
      {slides.length > 1 && <><button className="hp-arrow hp-prev" onClick={() => go(-1)} aria-label="قبلی">›</button>
      <button className="hp-arrow hp-next" onClick={() => go(1)} aria-label="بعدی">‹</button>
      <div className="hp-dots">{slides.map((slide, n) => <button type="button" key={slide.id} className={n === i % slides.length ? "on" : ""} onClick={() => setI(n)} aria-label={`نمایش تصویر ${n + 1}`} aria-current={n === i % slides.length ? "true" : undefined} />)}</div>
      {!reducedMotion && <button type="button" className="hp-pause" onClick={() => setPaused(!paused)}>{paused ? "پخش تصاویر" : "توقف تصاویر"}</button>}</>}
    </section>
  );
}

function NewsCard() {
  const { items, status } = useAnnouncements("portal");
  const list = sortAnnouncements(items.filter((a) => a.portal && isShown(a)));
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (list.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => x + 1), 8000);
    return () => clearInterval(t);
  }, [list.length, paused]);
  const cur = list.length ? list[i % list.length] : null;
  return (
    <div className="hp-card hp-news" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}>
      <div className="hp-news-label"><span className="hp-section-mark" />خبرها و اطلاعیه‌ها</div>
      {!cur && <div className="hp-news-empty"><span className="hp-news-empty-icon" aria-hidden="true"><PortalIcon name="truck" size={42} /></span><p className="hp-empty">{status === "loading" ? "در حال دریافت اطلاعیه‌ها..." : status === "error" ? "دریافت اطلاعیه‌ها ممکن نیست." : "اطلاعیه‌ی فعالی وجود ندارد."}</p>{status === "ready" && <small>خبرهای سازمان در این بخش نمایش داده می‌شوند.</small>}</div>}
      {cur && <>
        {cur.poster && <img className="hp-news-img" src={cur.poster} alt="" />}
        <div className="hp-news-body">
          <span className="hp-badge">{cur.pinned ? "اطلاعیه‌ی مهم" : "اطلاعیه"}</span>
          <h3>{cur.title}</h3>
          <p>{cur.summary}</p>
          <Link className="hp-more" href={`/announcements?id=${encodeURIComponent(cur.id)}`}>مشاهده اطلاعیه ←</Link>
        </div>
        {list.length > 1 && <div className="hp-ndots">{list.map((a, n) => <button type="button" key={a.id} className={n === i % list.length ? "on" : ""} onClick={() => setI(n)} aria-label={`نمایش اطلاعیه ${n + 1}`} aria-current={n === i % list.length ? "true" : undefined} />)}</div>}
      </>}
    </div>
  );
}

function MealCard({ cfg }: { cfg?: CardCfg }) {
  const [data, setData] = useState<{ off: boolean; meals: string[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/portal/meal", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setData).catch(() => setFailed(true));
  }, []);
  return <section className="hp-card hp-meal" aria-label={cfg?.title || "غذای روز"} style={cardStyle(cfg)}>
    <b className="hp-cal-t" style={{ color: cfg?.titleColor }}><PortalIcon name="cafe" size={24} /> {cfg?.title || "غذای روز"}</b>
    {cfg?.text && <p className="hp-cfg-text">{cfg.text}</p>}
    <span className="hp-meal-label">برنامه امروز</span>
    {failed ? <p>برنامه غذایی در دسترس نیست.</p> : !data ? <p>در حال دریافت برنامه غذایی...</p> : data.off ? <p>امروز تعطیل است.</p> : data.meals.length ? <ul>{data.meals.map((meal, i) => <li key={i}>{meal}</li>)}</ul> : <p>برای امروز غذایی ثبت نشده است.</p>}
    <Link className="hp-more" href="/cafe">مشاهده سامانه تغذیه ←</Link>
  </section>;
}

const cardStyle = (c?: CardCfg) => (c?.image ? { backgroundImage: `url(${c.image})` } : undefined);

function CalendarCard({ cfg }: { cfg?: CardCfg }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const nextEvent = useCalEvents()[0];
  const eventLabel = nextEvent ? `${nextEvent.holiday ? "تعطیلی پیش رو" : "رویداد پیش رو"}: ${nextEvent.title} · ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", timeZone: "Asia/Tehran" }).format(new Date(`${nextEvent.date}T12:00:00+03:30`))}` : "رویداد یا تعطیلی پیش رو ثبت نشده است.";
  const f = (o: Intl.DateTimeFormatOptions, loc: string) => now ? new Intl.DateTimeFormat(loc, { timeZone: "Asia/Tehran", ...o }).format(now) : "";
  return (
    <Link href="/calendar" className="hp-card hp-cal" style={{ ...cardStyle(cfg), color: "inherit", textDecoration: "none" }} aria-label="مشاهده تقویم سازمانی">
      <b className="hp-cal-t" style={{ color: cfg?.titleColor }}><PortalIcon name="calendar" size={24} /> {cfg?.title || "تقویم سازمان"}</b>
      {cfg?.text && <p className="hp-cfg-text">{cfg.text}</p>}
      <div className="hp-cal-big">{f({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, "fa-IR-u-ca-persian")}</div>
      <div className="hp-cal-sub">{f({ day: "numeric", month: "long", year: "numeric" }, "ar-SA-u-ca-islamic-umalqura-nu-arabext")}</div>
      <div className="hp-cal-sub hp-cal-gregorian">{f({ day: "numeric", month: "long", year: "numeric" }, "fa-IR-u-ca-gregory")}</div>
      <div className="hp-cal-ev" title={eventLabel}>
        {nextEvent && <span className="hp-cal-dot" aria-hidden="true" />}<span>{eventLabel}</span>
      </div>
    </Link>
  );
}

function Rotator({ list, label, msg, emptyMessage, cfg, birthday = false, hire = false }: { list: { id: string | number; name: string; unit: string; note?: string; photo?: string | null }[]; label: string; msg: string; emptyMessage?: string; cfg?: CardCfg; birthday?: boolean; hire?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, [list.length]);
  const c = list.length ? list[i % list.length] : null;
  return (
    <div className={`hp-card hp-person${birthday ? " hp-birthday" : ""}${hire ? " hp-hire" : ""}`} style={cardStyle(cfg)}>
      <img key={c?.id ?? "empty"} src={c?.photo || "/assets/sample/avatar-sample.svg"} alt="" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/assets/sample/avatar-sample.svg"; }} />
      <div>
        <span style={{ color: cfg?.titleColor }}>• {cfg?.title || label}{list.length > 1 ? ` (${(i % list.length) + 1}/${list.length})` : ""}</span>
        {cfg?.text && <p className="hp-cfg-text">{cfg.text}</p>}
        {c ? <><b>{c.name}{c.unit ? ` · ${c.unit}` : ""}</b><small>{c.note || msg}</small></> : <small>{emptyMessage || "موردی برای نمایش وجود ندارد."}</small>}
      </div>
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    const timer = window.setInterval(() => window.location.reload(), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { value: page } = useSharedPortalStore("home", pageDef("home").defaults);
  const me = useMe();
  const [tiles] = useTiles();
  const visibleTiles = tiles.filter((tile) => tile.on && safePortalLink(tile.href));
  const [cards] = useCards();
  const cfg = (id: CardCfg["id"]) => cards.find((c) => c.id === id);
  const mealOn = cfg("meal")?.on !== false;
  const calendarOn = cfg("calendar")?.on !== false;
  const birthdayOn = cfg("birthday")?.on !== false;
  const hireOn = cfg("hire")?.on !== false;
  const [bd, setBd] = useState<{ id: number; name: string; unit: string; title: string; days: number; label: string; note: string; photo?: string | null }[]>([]);
  const [hires, setHires] = useState<{ id: number; name: string; unit: string; title: string; days: number; note: string; photo?: string | null }[]>([]);
  const [peopleScope, setPeopleScope] = useState<string>("loading");
  useEffect(() => {
    fetch("/api/portal/people", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then((d) => { setBd(d.birthdays || []); setHires(d.hires || []); setPeopleScope(d.scope || "location"); }).catch(() => setPeopleScope("error"));
  }, []);
  return (
    <div className="hp" style={page.accent ? ({ "--c-accent": page.accent } as React.CSSProperties) : undefined}>
      <header className="hp-hdr">
        <img src="/brand/logo.svg" alt="آپادانا کاوش" />
        <div className="hp-brand"><b>آپادانا کاوش ایرانیان</b><small>{page.title || "شرکت مهندسی و معدنی"}</small></div>
        <div className="hp-sp" />
        {page.showWidgets && <><ClockWidget /><WeatherWidget /></>}
        {me ? <UserMenu name={`${me.firstName} ${me.lastName}`} role={roleLabel(me.role)} code={me.code.replace(/\d/g, (d) => "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[+d])} /> : me === null ? <Link className="hp-login" href="/login">ورود به سامانه</Link> : null}
      </header>

      <div className="hp-feature-row"><Hero slides={(validHomeSlides(page.slides) ? page.slides : defaultHomeSlides).filter(slide => slide.enabled)} /><NewsCard /></div>

      <div className="hp-wrap">
        <section className="hp-services" aria-labelledby="hp-services-title">
          <div className="hp-section-heading"><div><span className="hp-eyebrow">دسترسی سریع</span><h2 id="hp-services-title">سامانه‌های سازمان</h2></div><p>خدمات مورد نیاز شما، در یک نگاه</p></div>
        <div className={`hp-r2${visibleTiles.length > 6 ? " hp-r2-many" : ""}`}>
          {visibleTiles.map((s) => (
            <Link key={s.id} href={safePortalLink(s.href)!} className="hp-card hp-sys">
              <span className="hp-sys-art" aria-hidden="true"><PortalIcon name={s.icon} /></span>
              {s.locked && me === null && <span className="hp-lock">نیازمند ورود</span>}
              {me && ["/hr/attendance", "/automation", "/erp"].includes(s.href) && <span className="hp-lock">به‌زودی</span>}
              <span className="hp-ico">{s.image ? <img src={s.image} alt="" /> : <PortalIcon name={s.icon} />}</span>
              <b style={{ color: s.titleColor }}>{s.title}</b><small>{s.desc}</small>
              <span className="hp-go">‹</span>
            </Link>
          ))}
        </div>
        </section>

        <div className="hp-dashboard-grid">
          {birthdayOn && <Rotator birthday cfg={cfg("birthday")} list={bd.map((b) => ({ ...b, unit: [b.unit, b.title].filter(Boolean).join(" · "), note: b.note }))} label="تولد همکاران" msg="" emptyMessage={peopleScope === "loading" ? "در حال دریافت اطلاعات…" : peopleScope === "login_required" ? "برای مشاهده همکاران محل خدمت خود وارد شوید." : peopleScope === "location_missing" ? "محل خدمت شما ثبت نشده است؛ با منابع انسانی تماس بگیرید." : peopleScope === "error" ? "دریافت اطلاعات ممکن نشد." : undefined} />}
          {calendarOn && <CalendarCard cfg={cfg("calendar")} />}
          {mealOn && <MealCard cfg={cfg("meal")} />}
          {hireOn && <Rotator hire cfg={cfg("hire")} list={hires.map((h) => ({ ...h, unit: [h.unit, h.title].filter(Boolean).join(" · "), note: h.note }))} label="استخدام‌های جدید" msg="به خانواده‌ی بزرگ آپادانا خوش آمدید" emptyMessage={peopleScope === "loading" ? "در حال دریافت اطلاعات…" : peopleScope === "login_required" ? "برای مشاهده همکاران محل خدمت خود وارد شوید." : peopleScope === "location_missing" ? "محل خدمت شما ثبت نشده است؛ با منابع انسانی تماس بگیرید." : peopleScope === "error" ? "دریافت اطلاعات ممکن نشد." : undefined} />}
        </div>
        <ExternalNews config={externalNewsConfig(page.externalNews)} />
        {process.env.NEXT_PUBLIC_USE_MOCK === "true" && <p className="hp-sample">حالت داده‌های نمونه فعال است.</p>}
      </div>
    </div>
  );
}
