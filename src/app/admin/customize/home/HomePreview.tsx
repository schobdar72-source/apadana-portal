"use client";
import { useEffect, useState } from "react";
import { PortalIcon } from "@/components/PortalIcon";
import { useAnnouncements, isShown, sortAnnouncements } from "@/services/lobbyNews";
import type { CardCfg, CalConfig, Tile } from "@/services/portalData";
import { externalNewsConfig, type PageCfg } from "@/config/pages";
import { safePortalLink } from "@/lib/portalLink";

export function HomePreview({ page, tiles, cards, calendar }: { page: PageCfg; tiles: Tile[]; cards: CardCfg[]; calendar: CalConfig }) {
  const { items } = useAnnouncements("portal");
  const news = sortAnnouncements(items.filter((item) => item.portal && isShown(item)))[0];
  const [meal, setMeal] = useState<{ meals: string[]; off: boolean } | null>(null);
  useEffect(() => { fetch("/api/portal/meal", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then(setMeal).catch(() => {}); }, []);
  const cfg = (id: CardCfg["id"]) => cards.find((c) => c.id === id);
  const card = (id: CardCfg["id"], content: React.ReactNode) => {
    const c = cfg(id); if (c?.on === false) return null;
    return <div className="hc-live-card" key={id} style={c?.image ? { backgroundImage: `url(${c.image})` } : undefined}><b style={{ color: c?.titleColor }}>{c?.title}</b>{c?.text && <small>{c.text}</small>}{content}</div>;
  };
  return <section className="hc-section hc-preview-section" id="preview">
    <div className="hc-section-head"><div><h2>پیش‌نمایش صفحه اصلی</h2><p>چیدمان تقریبی با تنظیمات فعلی؛ تصاویر بنر و اطلاعات همکاران در صفحه اصلی کامل نمایش داده می‌شوند.</p></div></div>
    <div className="hc-live" style={{ "--preview-accent": page.accent || "#fcb400" } as React.CSSProperties}>
      <div className="hc-live-header"><b>آپادانا کاوش ایرانیان</b><small>{page.title || "شرکت مهندسی و معدنی"}</small>{page.showWidgets && <span>◷ ساعت و آب‌وهوا</span>}</div>
      <div className="hc-live-feature"><div className="hc-live-hero">پرتال آپادانا کاوش ایرانیان</div><div className="hc-live-card"><b>اطلاعیه‌ها</b><span>{news?.title || "اطلاعیه فعالی وجود ندارد"}</span>{news?.summary && <small>{news.summary}</small>}</div></div>
      <div className="hc-live-tiles">{tiles.filter((t) => t.on && safePortalLink(t.href)).map((t) => <div key={t.id} className="hc-live-tile">{t.image ? <img src={t.image} alt="" /> : <PortalIcon name={t.icon} size={19} />}<b style={{ color: t.titleColor }}>{t.title || "بدون عنوان"}</b><small>{t.desc}</small></div>)}</div>
      <div className="hc-live-row">{card("birthday", <small>اطلاعات همکاران در صفحه اصلی</small>)}
        {card("calendar", <><span>تقویم سازمان</span><small>{calendar.events.length ? `${calendar.events.length.toLocaleString("fa-IR")} رویداد دستی` : "تعطیلات و رویدادهای پیش رو"}</small></>)}
        {card("meal", <span>{!meal ? "دریافت برنامه غذایی" : meal.off ? "امروز تعطیل است" : meal.meals.join("، ") || "برای امروز غذایی ثبت نشده است"}</span>)}
        {card("hire", <small>اطلاعات همکاران در صفحه اصلی</small>)}
      </div>
      {externalNewsConfig(page.externalNews).enabled && <div className="hc-live-card"><b>خبرهای روز · {externalNewsConfig(page.externalNews).source === "irna" ? "ایرنا" : "مهر"}</b><small>{externalNewsConfig(page.externalNews).count.toLocaleString("fa-IR")} تیتر از خبرگزاری در صفحه اصلی نمایش داده می‌شود.</small></div>}
    </div>
  </section>;
}
