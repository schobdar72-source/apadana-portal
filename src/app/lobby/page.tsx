"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useLobbyPosters, isActive } from "@/services/lobbyPosters";
import { AutoScroll } from "@/components/AutoScroll";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { useAnnouncements, isShown, sortAnnouncements } from "@/services/lobbyNews";
import { useSharedPortalStore } from "@/services/sharedPortalStore";
import { defaultExternalNews, externalNewsConfig, type PageCfg } from "@/config/pages";
import { usePageCfg } from "@/services/pageCfg";
import { PageGate } from "@/components/PageFrame";
import { useLobbyCards, type LobbyCard } from "@/services/lobbyCards";
import { lobbyHeaderStyle, useLobbyHeader } from "@/services/lobbyHeader";
import { useCalEvents } from "@/services/portalData";
import { PortalIcon } from "@/components/PortalIcon";
import { useLobbyWelcome } from "@/services/lobbyWelcome";
import { LobbyWelcomeText } from "@/components/LobbyWelcomeText";

// نمای تلویزیون لابی: بدون ورود، بدون منو، ۱۶:۹ تمام‌صفحه.
type Headline = { title:string; category:string; source:string };
type Rate = {id:string; name:string; price:number; updated:string; stale:boolean};
type DisplayData = {configured:boolean;location?:string;birthdays?:{id:number;name:string;unit:string;photo?:string|null}[];meal?:{lunch:string;lunch2:string;off:boolean}|null};
const timeText = (date: Date) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(date);
function LobbyEmpty({ icon, children }: { icon: string; children: string }) {
  return <div className="lb-empty"><span><PortalIcon name={icon} size={30} /></span><p>{children}</p></div>;
}
function OfficeContent({kind}:{kind:"birthdays"|"meal"}) {
  const [data,setData]=useState<DisplayData|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch("/api/lobby/display",{cache:"no-store"});if(!r.ok)throw new Error();const d=await r.json();if(active){setData(d);setError(false);}}catch{if(active)setError(true);}};void load();const t=setInterval(load,5*60*1000);return()=>{active=false;clearInterval(t);};},[]);
  if(error&&!data)return <LobbyEmpty icon="globe">دریافت اطلاعات دفتر مرکزی ممکن نیست.</LobbyEmpty>;
  if(!data)return <p className="lb-custom">در حال دریافت اطلاعات...</p>;
  if(!data.configured)return <LobbyEmpty icon="tool">محل خدمت نمایشگر در مدیریت لابی انتخاب نشده است.</LobbyEmpty>;
  if(kind==="birthdays")return data.birthdays?.length?<div className="lb-birthday-list">{data.birthdays.map(b=><div className="lb-birthday-person" key={b.id}><img src={b.photo || "/assets/sample/avatar-sample.svg"} alt="" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src="/assets/sample/avatar-sample.svg";}} /><div><b>{b.name}</b>{b.unit && <small>{b.unit}</small>}<span>تولدت مبارک 🎉</span></div></div>)}</div>:<LobbyEmpty icon="gift">امروز تولدی ثبت نشده است.</LobbyEmpty>;
  return data.meal?<div className="lb-news"><b>{data.meal.off?"تعطیل":data.meal.lunch || "غذا ثبت نشده است"}</b>{data.meal.lunch2 && <p>{data.meal.lunch2}</p>}</div>:<LobbyEmpty icon="cafe">برنامه غذای امروز ثبت نشده است.</LobbyEmpty>;
}
const emptyHome = {externalNews: defaultExternalNews};
function LobbyCalendar() {
  const [now, setNow] = useState<Date | null>(null);
  const nextEvent = useCalEvents()[0];
  useEffect(() => { setNow(new Date()); const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const today = now ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now) : "در حال دریافت تاریخ...";
  const event = nextEvent ? `${nextEvent.holiday ? "تعطیلی پیش رو" : "رویداد پیش رو"}: ${nextEvent.title} · ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", timeZone: "Asia/Tehran" }).format(new Date(`${nextEvent.date}T12:00:00+03:30`))}` : "رویداد یا تعطیلی پیش رو ثبت نشده است.";
  return <a href="/calendar" className="lb-calendar" aria-label="مشاهده تقویم سازمانی" style={{ textDecoration: "none" }}><div className="lb-calendar-heading"><PortalIcon name="calendar" size={30} /><b>تقویم سازمان</b></div><strong>{today}</strong><small>{event}</small></a>;
}
function LiveNews() {
  const home=useSharedPortalStore<Partial<PageCfg>>("home",emptyHome);
  const config=externalNewsConfig(home.value.externalNews);
  const [items,setItems]=useState<Headline[]>([]), [failed,setFailed]=useState(false), [index,setIndex]=useState(0), [updated,setUpdated]=useState<Date|null>(null);
  useEffect(()=>{let active=true; const load=async()=>{try {const r=await fetch(`/api/portal/external-news?source=${config.source}`,{cache:"no-store"}); if(!r.ok)throw new Error(); const d=await r.json(); if(active&&d.items?.length){setItems(d.items.slice(0,config.count));setFailed(!!d.stale);if(!d.stale)setUpdated(new Date());}else if(active)setFailed(true);}catch{if(active)setFailed(true);}}; void load();const t=setInterval(load,15*60*1000);return()=>{active=false;clearInterval(t);};},[config.source,config.count]);
  useEffect(()=>{if(items.length<2)return;const t=setInterval(()=>setIndex(i=>(i+1)%items.length),8000);return()=>clearInterval(t);},[items.length]);
  const item=items[index%items.length];
  return item?<div className="lb-live-content"><div className="lb-news lb-fade" key={index}><b>{item.title}</b><small>{item.category} · {item.source==="mehr"?"مهر":item.source==="darsotoon"?"درستون":"ایرنا"}</small></div><small className={`lb-updated${failed?" stale":""}`}>{failed?"اتصال برقرار نیست · آخرین خبرهای دریافت‌شده":`به‌روزرسانی ${updated?timeText(updated):""}`}</small></div>:failed?<LobbyEmpty icon="globe">دریافت خبرها در حال حاضر ممکن نیست.</LobbyEmpty>:<p className="lb-custom">در حال دریافت خبرهای روز...</p>;
}
function LiveRates() {
  const [data,setData]=useState<{items:Rate[];stale:boolean}|null>(null),[error,setError]=useState(false),[page,setPage]=useState(0);
  useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch("/api/lobby/rates",{cache:"no-store"});if(!r.ok)throw new Error();const d=await r.json();if(active&&d.items?.length){setData(d);setError(false);}else if(active)setError(true);}catch{if(active)setError(true);}};void load();const t=setInterval(load,15*60*1000);return()=>{active=false;clearInterval(t);};},[]);
  const pages=Math.ceil((data?.items.length??0)/2);
  useEffect(()=>{if(pages<2)return;const t=setInterval(()=>setPage(p=>(p+1)%pages),7000);return()=>clearInterval(t);},[pages]);
  if(!data?.items.length)return error?<LobbyEmpty icon="chart">دریافت نرخ‌ها در حال حاضر ممکن نیست.</LobbyEmpty>:<p className="lb-custom">در حال دریافت نرخ‌ها...</p>;
  const current=page%pages, stale=data.stale||error;
  return <div className="lb-live-content"><div className="lb-rate-page lb-fade" key={current}>{data.items.slice(current*2,current*2+2).map(p=><div className={`lb-price${p.stale||stale?" stale":""}`} key={p.id}><div><b>{p.name}</b><small>به‌روزرسانی {timeText(new Date(p.updated))}{p.stale||stale?" · قدیمی":""}</small></div><strong>{p.price.toLocaleString("fa-IR")}</strong></div>)}</div><small className={`lb-updated${stale?" stale":""}`}>{pages>1&&<span className="lb-page-dots" aria-hidden="true">{Array.from({length:pages},(_,i)=><i key={i} className={i===current?"on":""} />)}</span>}{stale?"اتصال برقرار نیست · آخرین نرخ‌ها":"نرخ‌آرا · بازار آزاد"}</small></div>;
}

function Announcements() {
  const { items } = useAnnouncements("lobby");
  const visible=sortAnnouncements(items.filter((a) => a.lobby && isShown(a)));
  if (!visible.length) return <LobbyEmpty icon="mail">اطلاعیه‌ای برای نمایش وجود ندارد.</LobbyEmpty>;
  return <>{visible.map((a) => (
    <div className="lb-news" key={a.id}>
      {a.poster && <img src={a.poster} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 6 }} />}
      <b>{a.title}</b><p>{a.summary}</p>
      {a.body && <small>ادامه مطلب در پرتال</small>}
    </div>
  ))}</>;
}

function CardBody({ c }: { c: LobbyCard }) {
  switch (c.kind) {
    case "announcements":
      return <Announcements />;
    case "birthdays":
      return <OfficeContent kind="birthdays" />;
    case "news":
      return <LiveNews />;
    case "currency":
      return <LiveRates />;
    case "meal":
      return <OfficeContent kind="meal" />;
    default:
      return <p className="lb-custom">{c.text}</p>;
  }
}

// تصاویر پیش‌فرض وقتی پوستر فعالی نیست (قابل جایگزینی در public/assets)
const defaultPosters = ["/assets/mining/website_background_01_quarry.webp", "/assets/lobby/header_bg.webp"];

function PosterSlider() {
  const { posters } = useLobbyPosters();
  const list = posters.filter((p) => isActive(p));
  const [i, setI] = useState(0);
  const cur = list.length ? list[i % list.length] : null;
  useEffect(() => {
    if (list.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % list.length), Math.max(3, cur?.seconds ?? 8) * 1000);
    return () => clearTimeout(t);
  }, [i, list.length, cur?.seconds]);
  const [d, setD] = useState(0);
  useEffect(() => {
    if (list.length) return;
    const t = setTimeout(() => setD((x) => (x + 1) % defaultPosters.length), 8000);
    return () => clearTimeout(t);
  }, [d, list.length]);
  const src = cur?.image ?? defaultPosters[d];
  return <><img className="lb-poster-backdrop" src={src} alt="" aria-hidden="true" /><img className="lb-poster-img" src={src} alt={cur?.title ?? ""} /></>;
}

export default function LobbyTv() {
  const { cards } = useLobbyCards();
  const header = useLobbyHeader();
  const welcome = useLobbyWelcome();
  const { cfg } = usePageCfg("lobby");
  const active = cards.filter((c) => c.on);
  // تلویزیون کاربر ندارد: هر ۱۵ دقیقه کل صفحه خودکار تازه می‌شود.
  useEffect(() => {
    const t = setInterval(() => window.location.reload(), 15 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  if (!cfg.enabled) return <PageGate label="تلویزیون لابی" />;
  return (
    <div className="lb" style={cfg.accent ? ({ "--c-accent": cfg.accent } as CSSProperties) : undefined}>
      <header className={`lb-top${header.value.image ? " lb-top-custom" : ""}`} style={header.value.image ? lobbyHeaderStyle(header.value.image) : undefined}>
        {header.value.image && <div className="lb-welcome"><span className="lb-brand-logo"><img src="/brand/logo.svg" alt="لوگوی آپادانا کاوش ایرانیان" /></span><LobbyWelcomeText value={welcome.value} /></div>}
      </header>

      <div className="lb-grid">
        <div className={`lb-feature-row${cfg.showWidgets ? "" : " no-widgets"}`}>
          {cfg.showWidgets && <aside className="lb-side-widgets" aria-label="ساعت، آب‌وهوا و تقویم"><div className="lb-clock-weather"><ClockWidget showDate={false} /><WeatherWidget fixedCity="tehran" /></div><LobbyCalendar /></aside>}
          <section className="lb-poster" aria-label="پوستر"><PosterSlider /></section>
        </div>

        <section className="lb-cards" aria-label="کارت‌ها">
          {active.map((c) => (
            <article className="lb-panel" key={c.id}>
              <h2><span className="lb-panel-title">{c.kind === "news" && <span className="lb-news-live" aria-hidden="true" />}{c.title}</span>{c.kind === "currency" && <small>به تومان</small>}</h2>
              <AutoScroll><CardBody c={c} /></AutoScroll>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
