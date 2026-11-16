"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "@/styles/customize.css";
import { PortalIcon, iconNames } from "@/components/PortalIcon";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { AppShell } from "@/components/layout/AppShell";
import { SharedContentStatus } from "@/components/SharedContentStatus";
import { useSharedTiles, useSharedCal, useSharedCards, defaultCards, defaultTiles, defaultCal, uid, fileToDataUrl, type Tile, type CardCfg } from "@/services/portalData";
import { useSharedPortalStore } from "@/services/sharedPortalStore";
import { pageDef, externalNewsConfig, defaultExternalNews, type ExternalNewsConfig, type PageCfg } from "@/config/pages";
import { safePortalLink } from "@/lib/portalLink";
import { HomePreview } from "./HomePreview";
import { defaultHomeSlides, validHomeSlides, type HomeSlide } from "@/config/homeSlides";
import { optimizeSlide } from "@/lib/optimizeSlide";

const cardLabels: Record<CardCfg["id"], string> = { calendar: "تقویم سازمان", birthday: "تولد همکاران", hire: "استخدام‌های جدید", meal: "غذای روز" };
const iconLabels: Record<string, string> = { cafe: "کافه", clock: "ساعت", ticket: "تیکت", mail: "نامه", chart: "نمودار", users: "کاربران", calendar: "تقویم", doc: "سند", shield: "سپر", truck: "خودرو", tool: "ابزار", book: "کتاب", globe: "جهان", wallet: "کیف پول", gift: "هدیه", phone: "تلفن" };
const locked = (status: string) => ["loading", "error", "conflict"].includes(status);

function ImagePick({ value, label, onChange }: { value?: string; label: string; onChange: (value: string | undefined) => void }) {
  const pick = async (f?: File) => {
    if (!f) return;
    try { onChange(await fileToDataUrl(f)); } catch (e) { alert(e instanceof Error ? e.message : "خطا در خواندن فایل"); }
  };
  return <div className="hc-image-picker">
    {value && <img src={value} alt={`تصویر ${label}`} />}
    <label className="hc-button hc-button-subtle">{value ? "تغییر تصویر" : "انتخاب تصویر"}<input type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
    {value && <button type="button" className="hc-button hc-button-subtle" onClick={() => onChange(undefined)}>حذف تصویر</button>}
    <small>حداکثر ۳۰۰ کیلوبایت</small>
  </div>;
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <label className="hc-field hc-color"><span>{label}</span><input type="color" value={value || "#1f2a44"} onChange={(e) => onChange(e.target.value)} /></label>;
}

export default function PortalAdmin() {
  const tileStore = useSharedTiles(); const { value: tiles, save: saveTiles } = tileStore;
  const cardStore = useSharedCards(); const { value: savedCards, save: saveCards } = cardStore;
  const calStore = useSharedCal(); const { value: cal, save: saveCal } = calStore;
  const homeStore = useSharedPortalStore<PageCfg>("home", pageDef("home").defaults);
  const [backupMessage, setBackupMessage] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [slideBusy, setSlideBusy] = useState(false);
  const [slideMessage, setSlideMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const homeValueRef = useRef(homeStore.value);
  homeValueRef.current = homeStore.value;
  // Older configurations have no meal card; supply its defaults without overwriting them.
  const cards = [...savedCards, ...defaultCards.filter((c) => !savedCards.some((s) => s.id === c.id))];
  const hasUnsaved = slideBusy || [homeStore, tileStore, cardStore, calStore].some((store) => store.dirty);
  const ready = [homeStore, tileStore, cardStore, calStore].every((store) => store.status === "ready" && !store.dirty) && !restoring && !slideBusy;
  useEffect(() => {
    if (!hasUnsaved) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onLink = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.hash && link.pathname === location.pathname) return;
      if (!confirm("تغییراتی هنوز ذخیره نشده‌اند. صفحه را ترک می‌کنید؟")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onLink, true); };
  }, [hasUnsaved]);
  const reset = <T,>(name: string, save: (value: T) => void, defaults: T) => {
    if (confirm(`تنظیمات «${name}» به حالت پیش‌فرض برگردد؟ این تغییر برای همه کاربران اعمال می‌شود.`)) save(structuredClone(defaults));
  };
  const exportBackup = () => {
    const backup = { format: "apadana-home-settings", version: 1, exportedAt: new Date().toISOString(), sections: { home: homeStore.value, tiles, cards: savedCards, calendar: cal } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `apadana-home-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMessage("فایل پشتیبان تنظیمات صفحه اصلی آماده شد.");
  };
  const restoreBackup = async (file?: File) => {
    if (!file) return;
    setBackupMessage("");
    if (file.size > 8_000_000) { setBackupMessage("حجم فایل پشتیبان بیشتر از حد مجاز است."); return; }
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.format !== "apadana-home-settings" || backup?.version !== 1 || !backup.sections) { setBackupMessage("فایل پشتیبان معتبر نیست."); return; }
      const revisions = { home: homeStore.getRevision(), tiles: tileStore.getRevision(), cards: cardStore.getRevision(), calendar: calStore.getRevision() };
      if (!confirm("تنظیمات عمومی، سامانه‌ها، کارت‌ها و تقویم با محتویات این فایل جایگزین شوند؟ این تغییر برای همه کاربران اعمال می‌شود.")) return;
      setRestoring(true);
      const response = await fetch("/api/portal/home-backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...backup, revisions }) });
      if (!response.ok) { setBackupMessage(response.status === 409 ? "تنظیمات هم‌زمان تغییر کرده‌اند؛ صفحه را تازه‌سازی و دوباره تلاش کنید." : response.status === 400 ? "فایل پشتیبان معتبر نیست یا ساختار آن پشتیبانی نمی‌شود." : "بازیابی انجام نشد؛ اتصال و دسترسی را بررسی کنید."); return; }
      window.location.reload();
    } catch { setBackupMessage("خواندن یا بازیابی فایل ممکن نبود."); }
    finally { setRestoring(false); }
  };
  const upd = (id: string, patch: Partial<Tile>) => saveTiles(tiles.map((t) => t.id === id ? { ...t, ...patch } : t));
  const updCard = (id: CardCfg["id"], patch: Partial<CardCfg>) => saveCards(cards.map((c) => c.id === id ? { ...c, ...patch } : c));
  const external = externalNewsConfig(homeStore.value.externalNews);
  const slides = validHomeSlides(homeStore.value.slides) ? homeStore.value.slides : defaultHomeSlides;
  const saveSlides = (next: HomeSlide[]) => homeStore.save({ ...homeStore.value, slides: next });
  const chooseSlide = async (file?: File, replaceId?: string) => {
    if (!file) return;
    setSlideBusy(true); setSlideMessage("در حال آماده‌سازی تصویر…");
    try {
      const result = await optimizeSlide(file);
      const latestHome = homeValueRef.current;
      const latestSlides = validHomeSlides(latestHome.slides) ? latestHome.slides : defaultHomeSlides;
      if (replaceId && !latestSlides.some(s => s.id === replaceId)) throw new Error("اسلاید موردنظر تغییر کرده است؛ دوباره تلاش کنید.");
      const next = replaceId ? latestSlides.map(s => s.id === replaceId ? { ...s, image: result.image } : s) : [...latestSlides, { id: uid(), image: result.image, enabled: true, style: "dark" as const }];
      if (!validHomeSlides(next)) throw new Error("امکان افزودن تصویر وجود ندارد.");
      homeStore.save({ ...latestHome, slides: next });
      setSlideMessage(`تصویر از ${Math.ceil(file.size / 1024).toLocaleString("fa-IR")} به ${Math.ceil(result.bytes / 1024).toLocaleString("fa-IR")} کیلوبایت کاهش یافت (${result.width.toLocaleString("fa-IR")} × ${result.height.toLocaleString("fa-IR")} پیکسل).`);
    } catch (e) { setSlideMessage(e instanceof Error ? e.message : "آماده‌سازی تصویر ممکن نیست."); }
    finally { setSlideBusy(false); }
  };
  const updateExternal = (patch: Partial<ExternalNewsConfig>) => homeStore.save({ ...homeStore.value, externalNews: { ...external, ...patch } });
  const move = (i: number, delta: number) => {
    const next = [...tiles]; const j = i + delta; if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]]; saveTiles(next);
  };
  return <AppShell title="سفارشی‌سازی: صفحه‌ی اصلی" activeHref="/admin/customize">
    <div className="hc-page">
      <div className="hc-heading">
        <div><Link href="/admin/customize" className="hc-back">← همه صفحه‌ها</Link><h1>مدیریت صفحه اصلی</h1><p>ظاهر و محتوای صفحه اصلی پرتال را مدیریت کنید.</p></div>
        <Link className="hc-button hc-button-primary" href="/" target="_blank">مشاهده صفحه اصلی ↗</Link>
      </div>
      <div className="hc-intro">تغییرات به‌صورت خودکار در سرور ذخیره می‌شوند و برای همه کاربران نمایش داده خواهند شد.</div>
      <nav className="hc-nav" aria-label="بخش‌های تنظیمات صفحه اصلی">
        <a href="#preview">پیش‌نمایش</a><a href="#general">تنظیمات عمومی</a><a href="#slides">اسلایدر</a><a href="#tiles">سامانه‌ها</a><a href="#cards">کارت‌ها</a><a href="#calendar">تقویم سازمان</a><a href="#external-news">خبرهای روز</a>
      </nav>

      <HomePreview page={homeStore.value} tiles={tiles} cards={cards} calendar={cal} />
      <section className="hc-section hc-backup"><div><h2>پشتیبان تنظیمات صفحه اصلی</h2><p>فایل شامل تنظیمات عمومی، سامانه‌ها، کارت‌ها و تقویم است؛ اطلاعیه‌ها و اطلاعات پرسنلی در آن نیستند.</p></div><div className="hc-actions"><button type="button" className="hc-button" disabled={!ready} onClick={exportBackup}>دریافت پشتیبان</button><button type="button" className="hc-button" disabled={!ready} onClick={() => fileRef.current?.click()}>بازیابی از فایل</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void restoreBackup(e.target.files?.[0]); e.target.value = ""; }} /></div>{backupMessage && <p role="status">{backupMessage}</p>}</section>

      <section className="hc-section" id="general">
        <div className="hc-section-head"><div><h2>تنظیمات عمومی</h2><p>عنوان، رنگ و ابزارهای سربرگ صفحه اصلی</p></div><button type="button" className="hc-button" disabled={!ready} onClick={() => reset("تنظیمات عمومی", homeStore.save, { ...pageDef("home").defaults, externalNews: external, ...(homeStore.value.slides ? { slides: homeStore.value.slides } : {}) })}>بازگردانی پیش‌فرض</button></div>
        <SharedContentStatus label="تنظیمات عمومی" legacyKey="portal.pagecfg.v1" {...homeStore} select={(v) => v?.home ? { ...pageDef("home").defaults, ...v.home } : null} />
        <fieldset disabled={locked(homeStore.status)} className="hc-fieldset">
          <div className="hc-general-grid">
            <label className="hc-field"><span>عنوان زیر نام شرکت</span><input placeholder="شرکت مهندسی و معدنی" value={homeStore.value.title} onChange={(e) => homeStore.save({ ...homeStore.value, title: e.target.value })} /></label>
            <ColorField label="رنگ تأکیدی" value={homeStore.value.accent || "#fcb400"} onChange={(accent) => homeStore.save({ ...homeStore.value, accent })} />
            <label className="hc-check"><input type="checkbox" checked={homeStore.value.showWidgets} onChange={(e) => homeStore.save({ ...homeStore.value, showWidgets: e.target.checked })} /> نمایش ساعت و آب‌وهوا</label>
          </div>
        </fieldset>
      </section>

      <section className="hc-section" id="slides">
        <div className="hc-section-head"><div><h2>تصاویر اسلایدر</h2><p>تصاویر، ترتیب و نمایش اسلایدهای صفحه اصلی را مدیریت کنید.</p></div><button type="button" className="hc-button" disabled={!ready || slideBusy} onClick={() => reset("اسلایدر", saveSlides, defaultHomeSlides)}>بازگردانی پیش‌فرض</button></div>
        <SharedContentStatus label="تصاویر اسلایدر" {...homeStore} />
        <p className="hc-help">حداکثر ۵ تصویر؛ فایل JPG، PNG یا WebP تا ۱۰ مگابایت. تصویر به‌صورت خودکار کوچک و به WebP کم‌حجم تبدیل می‌شود. حداقل یک تصویر باید فعال بماند.</p>
        <fieldset disabled={locked(homeStore.status) || slideBusy} className="hc-fieldset hc-list">
          {slides.map((slide, i) => <article className="hc-item hc-slide-item" key={slide.id}>
            <img className="hc-slide-thumb" src={slide.image} alt={`پیش‌نمایش اسلاید ${i + 1}`} />
            <div className="hc-slide-body"><strong>اسلاید {(i + 1).toLocaleString("fa-IR")}</strong><label className="hc-check"><input type="checkbox" checked={slide.enabled} disabled={slide.enabled && slides.filter(s => s.enabled).length === 1} onChange={e => saveSlides(slides.map(s => s.id === slide.id ? { ...s, enabled: e.target.checked } : s))} /> نمایش اسلاید</label>
              <label className="hc-field"><span>رنگ نوشته روی تصویر</span><select value={slide.style} onChange={e => saveSlides(slides.map(s => s.id === slide.id ? { ...s, style: e.target.value as HomeSlide["style"] } : s))}><option value="dark">روشن، برای تصویر تیره</option><option value="light">تیره، برای تصویر روشن</option><option value="artwork">طرح گرافیکی آماده</option></select></label>
              <div className="hc-actions"><label className="hc-button hc-button-subtle hc-slide-upload">تغییر تصویر<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void chooseSlide(e.target.files?.[0], slide.id); e.target.value = ""; }} /></label><button type="button" className="hc-button hc-button-subtle" disabled={i === 0} aria-label={`انتقال اسلاید ${i + 1} به قبل`} onClick={() => { const next = [...slides]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; saveSlides(next); }}>↑</button><button type="button" className="hc-button hc-button-subtle" disabled={i === slides.length - 1} aria-label={`انتقال اسلاید ${i + 1} به بعد`} onClick={() => { const next = [...slides]; [next[i + 1], next[i]] = [next[i], next[i + 1]]; saveSlides(next); }}>↓</button><button type="button" className="hc-button hc-danger" disabled={slide.enabled && slides.filter(s => s.enabled).length === 1} onClick={() => { if (confirm("این اسلاید حذف شود؟")) saveSlides(slides.filter(s => s.id !== slide.id)); }}>حذف</button></div>
            </div>
          </article>)}
          {slides.length < 5 && <label className="hc-button hc-button-add hc-slide-upload">+ افزودن تصویر<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void chooseSlide(e.target.files?.[0]); e.target.value = ""; }} /></label>}
        </fieldset>
        {slideMessage && <p className="hc-help" role="status">{slideMessage}</p>}
      </section>

      <section className="hc-section" id="external-news">
        <div className="hc-section-head"><div><h2>خبرهای روز</h2><p>نمایش تیترهای خبرگزاری در پایین صفحه اصلی.</p></div><button type="button" className="hc-button" disabled={!ready} onClick={() => { if (confirm("تنظیمات خبرهای روز به حالت پیش‌فرض برگردد؟")) updateExternal(defaultExternalNews); }}>بازگردانی پیش‌فرض</button></div>
        <SharedContentStatus label="تنظیمات خبرهای روز" {...homeStore} />
        <fieldset disabled={locked(homeStore.status)} className="hc-fieldset">
          <div className="hc-general-grid">
            <label className="hc-check"><input type="checkbox" checked={external.enabled} onChange={e => updateExternal({ enabled: e.target.checked })} /> نمایش خبرهای روز</label>
            <label className="hc-field"><span>منبع خبر</span><select value={external.source} onChange={e => updateExternal({ source: e.target.value as ExternalNewsConfig["source"], sourceExplicit: true })}><option value="darsotoon">درستون</option><option value="irna">ایرنا</option><option value="mehr">مهر</option></select></label>
            <label className="hc-field"><span>تعداد تیترها</span><select value={external.count} onChange={e => updateExternal({ count: Number(e.target.value) })}>{[10, 15, 20].map(n => <option key={n} value={n}>{n.toLocaleString("fa-IR")} خبر</option>)}</select></label>
          </div>
          <p className="hc-help">تیترها تقریباً هر ۱۵ دقیقه از منبع انتخاب‌شده دریافت می‌شوند. با انتخاب ایرنا یا مهر، خبرهای دسته‌بندی‌شده نیز از مهر دریافت می‌شوند. این تنظیمات در پشتیبان ذخیره می‌شوند.</p>
        </fieldset>
      </section>

      <section className="hc-section" id="tiles">
        <div className="hc-section-head"><div><h2>سامانه‌ها</h2><p>محتوا، ترتیب و نمایش کارت‌های سامانه‌ها در صفحه اصلی</p></div><div className="hc-actions"><span className="hc-count">{tiles.length.toLocaleString("fa-IR")} سامانه</span><button type="button" className="hc-button" disabled={!ready} onClick={() => reset("سامانه‌ها", saveTiles, defaultTiles)}>بازگردانی پیش‌فرض</button></div></div>
        <SharedContentStatus label="سامانه‌ها" legacyKey="portal.tiles.v1" {...tileStore} />
        <fieldset disabled={locked(tileStore.status)} className="hc-fieldset hc-list">
          {tiles.map((t, i) => <article key={t.id} className="hc-item">
            <div className="hc-item-head"><div className="hc-item-name"><span className="hc-icon">{t.image ? <img src={t.image} alt="" /> : <PortalIcon name={t.icon} />}</span><div><strong>{t.title || "سامانه بدون عنوان"}</strong><small>{t.on ? "در صفحه اصلی نمایش داده می‌شود" : "در صفحه اصلی پنهان است"}</small></div></div><div className="hc-actions"><button type="button" className="hc-button hc-button-subtle" disabled={i === 0} aria-label={`انتقال ${t.title} به قبل`} onClick={() => move(i, -1)}>↑</button><button type="button" className="hc-button hc-button-subtle" disabled={i === tiles.length - 1} aria-label={`انتقال ${t.title} به بعد`} onClick={() => move(i, 1)}>↓</button><button type="button" className="hc-button hc-danger" onClick={() => { if (confirm(`سامانه «${t.title || "بدون عنوان"}» حذف شود؟`)) saveTiles(tiles.filter((x) => x.id !== t.id)); }}>حذف</button></div></div>
            <div className="hc-fields">
              <label className="hc-field"><span>عنوان سامانه</span><input value={t.title} onChange={(e) => upd(t.id, { title: e.target.value })} /></label>
              <label className="hc-field"><span>توضیح کوتاه</span><input value={t.desc} onChange={(e) => upd(t.id, { desc: e.target.value })} /></label>
              <label className="hc-field"><span>آدرس سامانه</span><input dir="ltr" aria-invalid={!safePortalLink(t.href)} value={t.href} onChange={(e) => upd(t.id, { href: e.target.value })} /><small className={safePortalLink(t.href) ? "hc-link-hint" : "hc-link-error"}>{safePortalLink(t.href) ? "مسیر داخلی یا نشانی کامل http/https" : "آدرس معتبر نیست؛ مسیر داخلی یا نشانی کامل وارد کنید."}</small>{safePortalLink(t.href) && <a className="hc-test-link" href={safePortalLink(t.href)!} target="_blank" rel="noopener noreferrer">باز کردن لینک ↗</a>}</label>
              <ColorField label="رنگ عنوان" value={t.titleColor} onChange={(titleColor) => upd(t.id, { titleColor })} />
            </div>
            <div className="hc-options"><label className="hc-check"><input type="checkbox" checked={t.on} onChange={(e) => upd(t.id, { on: e.target.checked })} /> نمایش سامانه</label><label className="hc-check"><input type="checkbox" checked={t.locked} onChange={(e) => upd(t.id, { locked: e.target.checked })} /> نمایش برچسب «نیازمند ورود»</label></div>
            <p className="hc-help">این برچسب فقط راهنمای نمایش است؛ دسترسی به هر سامانه جداگانه کنترل می‌شود.</p>
            <details className="hc-details"><summary>آیکون و تصویر سامانه</summary><div className="hc-icon-grid" role="group" aria-label={`آیکون ${t.title}`}>{iconNames.map((name) => <button type="button" key={name} className={t.icon === name && !t.image ? "is-selected" : ""} aria-pressed={t.icon === name && !t.image} onClick={() => upd(t.id, { icon: name, image: undefined })}><PortalIcon name={name} size={20} /><span>{iconLabels[name] || name}</span></button>)}</div><ImagePick label={t.title} value={t.image} onChange={(image) => upd(t.id, { image })} /></details>
          </article>)}
          <button type="button" className="hc-button hc-button-add" onClick={() => saveTiles([...tiles, { id: uid(), title: "سامانه جدید", desc: "", href: "/", icon: "doc", on: true, locked: true }])}>+ افزودن سامانه</button>
        </fieldset>
      </section>

      <section className="hc-section" id="cards">
        <div className="hc-section-head"><div><h2>کارت‌های صفحه اصلی</h2><p>عنوان و ظاهر کارت‌ها را تنظیم کنید.</p></div><button type="button" className="hc-button" disabled={!ready} onClick={() => reset("کارت‌ها", saveCards, defaultCards)}>بازگردانی پیش‌فرض</button></div>
        <SharedContentStatus label="کارت‌ها" legacyKey="portal.cards.v1" {...cardStore} />
        <fieldset disabled={locked(cardStore.status)} className="hc-fieldset hc-card-grid">
          {cards.map((c) => <article className="hc-item hc-card-editor" key={c.id}>
            <div className="hc-item-head"><strong>{cardLabels[c.id]} {c.on === false && <span className="hc-hidden">پنهان در صفحه اصلی</span>}</strong><label className="hc-check"><input type="checkbox" checked={c.on !== false} onChange={(e) => updCard(c.id, { on: e.target.checked })} /> نمایش کارت</label></div>
            <div className="hc-card-preview" style={c.image ? { backgroundImage: `url(${c.image})` } : undefined}><b style={{ color: c.titleColor || "#1f2a44" }}>{c.title || cardLabels[c.id]}</b><small>{c.text || "پیش‌نمایش عنوان کارت"}</small></div>
            <label className="hc-field"><span>عنوان کارت</span><input value={c.title} onChange={(e) => updCard(c.id, { title: e.target.value })} /></label>
            <label className="hc-field"><span>متن دلخواه</span><input value={c.text || ""} onChange={(e) => updCard(c.id, { text: e.target.value })} /></label>
            <ColorField label="رنگ عنوان" value={c.titleColor} onChange={(titleColor) => updCard(c.id, { titleColor })} />
            <ImagePick label={cardLabels[c.id]} value={c.image} onChange={(image) => updCard(c.id, { image })} />
            {c.id === "meal" && <p className="hc-help">نام غذا از برنامه روز در مدیریت کافی‌شاپ دریافت می‌شود.</p>}
          </article>)}
        </fieldset>
      </section>

      <section className="hc-section" id="calendar">
        <div className="hc-section-head"><div><h2>تقویم سازمان</h2><p>رویدادهای سازمانی و تعطیلات موردنظر را ثبت کنید.</p></div><button type="button" className="hc-button" disabled={!ready} onClick={() => reset("تقویم سازمان", saveCal, defaultCal)}>بازگردانی پیش‌فرض</button></div>
        <SharedContentStatus label="تقویم" legacyKey="portal.cal.v1" {...calStore} />
        <fieldset disabled={locked(calStore.status)} className="hc-fieldset hc-list">
          {!cal.events.length && <p className="hc-empty">هنوز رویدادی ثبت نشده است. تعطیلات رسمی موجود به‌صورت خودکار نمایش داده می‌شوند.</p>}
          {[...cal.events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => <div key={e.id} className="hc-event">
            <label className="hc-field"><span>عنوان رویداد</span><input value={e.title} onChange={(x) => saveCal({ ...cal, events: cal.events.map((y) => y.id === e.id ? { ...y, title: x.target.value } : y) })} /></label>
            <div className="hc-field"><span>تاریخ</span><JalaliDateInput label={`تاریخ ${e.title || "رویداد"}`} value={e.date} onChange={(v) => saveCal({ ...cal, events: cal.events.map((y) => y.id === e.id ? { ...y, date: v ?? y.date } : y) })} /></div>
            <label className="hc-check"><input type="checkbox" checked={e.holiday} onChange={(x) => saveCal({ ...cal, events: cal.events.map((y) => y.id === e.id ? { ...y, holiday: x.target.checked } : y) })} /> تعطیل</label>
            <button type="button" className="hc-button hc-danger" onClick={() => { if (confirm(`رویداد «${e.title || "بدون عنوان"}» حذف شود؟`)) saveCal({ ...cal, events: cal.events.filter((y) => y.id !== e.id) }); }}>حذف</button>
          </div>)}
          <button type="button" className="hc-button hc-button-add" onClick={() => saveCal({ ...cal, events: [...cal.events, { id: uid(), date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date()), title: "", holiday: false }] })}>+ افزودن رویداد</button>
          <details className="hc-details hc-advanced"><summary>تنظیمات پیشرفته تقویم</summary><p>برای نمایش رویدادهای یک منبع دیگر، نشانی فایل JSON را وارد کنید. تعطیلات رسمی از فایل موجود در برنامه خوانده می‌شوند.</p><label className="hc-field"><span>نشانی منبع رویدادها</span><input dir="ltr" placeholder="https://…" value={cal.sourceUrl} onChange={(e) => saveCal({ ...cal, sourceUrl: e.target.value })} /></label><small>فرمت: آرایه‌ای از date، title و holiday. به‌روزرسانی فایل تعطیلات: <code dir="ltr">node scripts/sync-time-ir.mjs</code></small></details>
        </fieldset>
      </section>
    </div>
  </AppShell>;
}
