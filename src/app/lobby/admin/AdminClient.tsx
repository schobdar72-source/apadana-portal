"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, DataTable, Note } from "@/components/ui";
import { useLobbyCards, type LobbyCard } from "@/services/lobbyCards";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { useLobbyPosters, isActive, type Poster } from "@/services/lobbyPosters";
import { useAnnouncements, isShown } from "@/services/lobbyNews";
import { SharedContentStatus } from "@/components/SharedContentStatus";
import { useSharedPortalStore } from "@/services/sharedPortalStore";
import { lobbyHeaderStyle, prepareLobbyHeader, useLobbyHeader } from "@/services/lobbyHeader";
import { optimizeSlide } from "@/lib/optimizeSlide";
import { defaultLobbyWelcome, useLobbyWelcome, type LobbyWelcome } from "@/services/lobbyWelcome";
import { LobbyWelcomeText } from "@/components/LobbyWelcomeText";
import { defaultExternalNews, externalNewsConfig, type PageCfg } from "@/config/pages";

const defaultDisplay = {locationId:null as number|null};
const defaultHome = { externalNews: defaultExternalNews };
type AdminTab = "overview" | "header" | "posters" | "content";
const tehranToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
const posterStatus = (poster: Poster, today: string) => !poster.on ? "خاموش" : !poster.permanent && poster.start && poster.start > today ? "زمان‌بندی‌شده" : !poster.permanent && poster.end && poster.end < today ? "منقضی" : "در حال نمایش";

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button className={`lb-tg ${on ? "on" : ""}`} onClick={onChange} aria-pressed={on} aria-label={label}>
      <span className="lb-knob" />
    </button>
  );
}

export function AdminClient() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const headerStore = useLobbyHeader();
  const welcomeStore = useLobbyWelcome();
  const [welcomeDraft, setWelcomeDraft] = useState<LobbyWelcome | null>(null);
  const welcomeValue = welcomeDraft ?? welcomeStore.value;
  const changeWelcome = (key: keyof LobbyWelcome, value: string) => setWelcomeDraft({ ...welcomeValue, [key]: value });
  const [headerDraft, setHeaderDraft] = useState<string | null>(null);
  const [headerError, setHeaderError] = useState("");
  const chooseHeader = async (file?: File) => {
    if (!file) return;
    setHeaderError("");
    try { setHeaderDraft(await prepareLobbyHeader(file)); }
    catch (e) { setHeaderError(e instanceof Error ? e.message : "پردازش تصویر ممکن نشد."); }
  };
  const displayStore=useSharedPortalStore("lobby-display",defaultDisplay);
  const [locations,setLocations]=useState<{id:number;name:string}[]>([]);
  const [locationsError,setLocationsError]=useState(false);
  useEffect(()=>{fetch("/api/lobby/locations",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setLocations).catch(()=>setLocationsError(true));},[]);
  const homeStore = useSharedPortalStore<Partial<PageCfg>>("home", defaultHome);
  const newsConfig = externalNewsConfig(homeStore.value.externalNews);
  const [sources, setSources] = useState({ rates: "در حال بررسی", news: "در حال بررسی" });
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [rates, newsResult] = await Promise.allSettled([
        fetch("/api/lobby/rates", { cache: "no-store" }).then(async response => { if (!response.ok) throw new Error(); return response.json(); }),
        fetch(`/api/portal/external-news?source=${newsConfig.source}`, { cache: "no-store" }).then(async response => { if (!response.ok) throw new Error(); return response.json(); }),
      ]);
      if (!active) return;
      const format = (date: string) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" }).format(new Date(date));
      const rateData = rates.status === "fulfilled" ? rates.value : null;
      const newsData = newsResult.status === "fulfilled" ? newsResult.value : null;
      const rateDates = rateData?.items?.map((item: { updated: string }) => Date.parse(item.updated)).filter(Number.isFinite) as number[] | undefined;
      setSources({ rates: rateData ? `${rateData.stale ? "آخرین داده موجود" : "فعال"}${rateDates?.length ? ` · ${format(new Date(Math.max(...rateDates)).toISOString())}` : ""}` : "دریافت ممکن نیست", news: newsData ? `${newsData.stale ? "آخرین داده موجود" : "فعال"}${newsData.updatedAt ? ` · ${format(newsData.updatedAt)}` : ""}` : "دریافت ممکن نیست" });
    };
    void load(); const interval = setInterval(load, 15 * 60 * 1000);
    return () => { active = false; clearInterval(interval); };
  }, [newsConfig.source]);
  const cardStore = useLobbyCards();
  const { cards, save } = cardStore;
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const addCard = () => {
    if (!newTitle.trim()) return;
    const c: LobbyCard = { id: `c${Date.now()}`, kind: "custom", title: newTitle.trim(), text: newText, on: true };
    save([...cards, c]); setNewTitle(""); setNewText("");
  };
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= cards.length) return;
    const n = [...cards]; [n[i], n[j]] = [n[j], n[i]]; save(n);
  };
  const posterStore = useLobbyPosters();
  const { posters, save: savePosters } = posterStore;
  const [posterMessage, setPosterMessage] = useState("");
  const [posterProcessing, setPosterProcessing] = useState(false);
  const upload = async (f?: File) => {
    if (!f) return;
    if (posters.length >= 20) { setPosterMessage("حداکثر ۲۰ پوستر قابل ثبت است."); return; }
    setPosterProcessing(true); setPosterMessage("در حال بهینه‌سازی تصویر...");
    try {
      const optimized = await optimizeSlide(f);
      const next = [...posters, { id: `p${Date.now()}`, title: f.name.replace(/\.[^.]+$/, ""), image: optimized.image, on: true, seconds: 8 }];
      if (JSON.stringify(next).length > 2_000_000) throw new Error("مجموع پوسترهای ذخیره‌شده از ظرفیت مجاز بیشتر است؛ ابتدا برخی پوسترها را حذف کنید.");
      savePosters(next);
      setPosterMessage(`تصویر از ${Math.ceil(f.size / 1024).toLocaleString("fa-IR")} به ${Math.ceil(optimized.bytes / 1024).toLocaleString("fa-IR")} کیلوبایت کاهش یافت (${optimized.width.toLocaleString("fa-IR")} × ${optimized.height.toLocaleString("fa-IR")} پیکسل).`);
    } catch (e) { setPosterMessage(e instanceof Error ? e.message : "پردازش تصویر ممکن نشد."); }
    finally { setPosterProcessing(false); }
  };
  const patch = (id: string, v: Partial<Poster>) => {
    const current = posters.find(poster => poster.id === id);
    if (!current) return;
    const next = { ...current, ...v };
    if (next.start && next.end && next.start > next.end) { setPosterMessage("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."); return; }
    setPosterMessage(""); savePosters(posters.map(poster => poster.id === id ? next : poster));
  };
  const movePoster = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= posters.length) return;
    const n = [...posters]; [n[i], n[j]] = [n[j], n[i]]; savePosters(n);
  };
  const newsStore = useAnnouncements();
  const { items: news } = newsStore;
  const hasDraft = !!welcomeDraft || headerDraft !== null || !!(newTitle || newText);
  const hasPending = hasDraft || [headerStore, welcomeStore, displayStore, posterStore, cardStore, newsStore].some(store => store.dirty);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (hasPending) { event.preventDefault(); event.returnValue = ""; } };
    const beforeNavigation = (event: MouseEvent) => {
      if (!hasPending || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.origin !== window.location.origin || anchor.pathname === window.location.pathname) return;
      if (!window.confirm("تغییرات ذخیره‌نشده دارید. از صفحه خارج می‌شوید؟")) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigation, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigation, true); };
  }, [hasPending]);
  const changeTab = (next: AdminTab) => { setTab(next); };
  const today = tehranToday();

  return (
    <AppShell title="مدیریت لابی" activeHref="/lobby/admin">
      <div className="lobby-admin">
      <nav className="lobby-admin-tabs" aria-label="بخش‌های مدیریت لابی">
        {([ ["overview", "نمای کلی"], ["header", "هدر و خوش‌آمدگویی"], ["posters", "اسلایدر"], ["content", "کارت‌ها و اطلاعیه‌ها"] ] as const).map(([id,label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => changeTab(id)}>{label}</button>)}
      </nav>
      {hasPending && <div className="lobby-admin-pending" role="status">تغییرات ذخیره‌نشده یا در حال ذخیره دارید.</div>}
      <section hidden={tab !== "overview"} className="lobby-admin-section">
        <Card title="نمای کلی لابی" aside={<a href="/lobby" target="_blank" rel="noreferrer">مشاهده لابی ↗</a>}>
          <div className="lobby-admin-stats">
            <div><span>پوسترهای فعال</span><strong>{posters.filter(poster => isActive(poster, today)).length.toLocaleString("fa-IR")}</strong></div>
            <div><span>اطلاعیه‌های لابی</span><strong>{news.filter(item => item.lobby && !item.disabled && isShown(item, today)).length.toLocaleString("fa-IR")}</strong></div>
            <div><span>کارت‌های فعال</span><strong>{cards.filter(card => card.on).length.toLocaleString("fa-IR")}</strong></div>
            <div><span>محل نمایشگر</span><strong>{locations.find(location => location.id === displayStore.value.locationId)?.name || "انتخاب نشده"}</strong></div>
          </div>
          <div className="lobby-admin-sources"><div><b>نرخ ارز و طلا · نرخ‌آرا</b><span>{sources.rates}</span></div><div><b>خبرهای روز · {newsConfig.source === "mehr" ? "مهر" : "ایرنا"} و منابع تکمیلی</b><span>{sources.news}</span></div></div>
        </Card>
      <Card title="محل خدمت نمایشگر">
        <SharedContentStatus label="محل نمایشگر" {...displayStore} />
        <label className="lobby-location-select">دفتر مرکزی را از محل‌های خدمت ثبت‌شده انتخاب کنید:{" "}
          <select value={displayStore.value.locationId ?? ""} disabled={displayStore.status!=="ready" || locationsError} onChange={e=>displayStore.save({locationId:e.target.value?Number(e.target.value):null})}>
            <option value="">انتخاب محل خدمت</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        {locationsError && <Note>دریافت محل‌های خدمت ممکن نشد.</Note>}
        <Note>تا انتخاب محل، اطلاعات تولد نمایش داده نمی‌شود. غذای ثبت‌شده مربوط به دفتر مرکزی است.</Note>
      </Card>
      </section>
      <section hidden={tab !== "header"} className="lobby-admin-section">
      <Card title="متن و رنگ خوش‌آمدگویی" aside="هدر نمایشگر لابی">
        <SharedContentStatus label="خوش‌آمدگویی لابی" {...welcomeStore} />
        <Note>متن و رنگ هر بخش را تغییر دهید و پس از بررسی پیش‌نمایش ذخیره کنید.</Note>
        <div className="lobby-header-preview lobby-preview-combined" style={lobbyHeaderStyle(headerDraft ?? (headerStore.value.image || "/assets/lobby/header_bg.webp"))}><div className="lb-welcome"><span className="lb-brand-logo"><img src="/brand/logo.svg" alt="لوگوی آپادانا کاوش ایرانیان" /></span><LobbyWelcomeText value={welcomeValue} /></div></div>
        <fieldset disabled={welcomeStore.status !== "ready"} className="lb-welcome-fields">
          {([ ["title","titleColor","نام اصلی"], ["highlight","highlightColor","بخش رنگی نام"], ["subtitle","subtitleColor","توضیح شرکت"], ["greeting","greetingColor","متن خوش‌آمدگویی"] ] as const).map(([textKey,colorKey,label]) => <div className="lb-welcome-field" key={textKey}>
            <label>{label}<input className="wd-search" maxLength={80} value={welcomeValue[textKey]} onChange={e=>changeWelcome(textKey,e.target.value)} /></label>
            <label>رنگ {label}<input type="color" value={welcomeValue[colorKey]} onChange={e=>changeWelcome(colorKey,e.target.value)} /></label>
          </div>)}
          <div className="lobby-header-actions"><Button disabled={!welcomeDraft} onClick={()=>{ if(welcomeDraft){welcomeStore.save(welcomeDraft);setWelcomeDraft(null);} }}>ذخیره متن و رنگ‌ها</Button>{welcomeDraft && <Button onClick={()=>setWelcomeDraft(null)}>انصراف</Button>}<Button onClick={()=>setWelcomeDraft({...defaultLobbyWelcome})}>بازگردانی مقادیر پیش‌فرض</Button></div>
        </fieldset>
      </Card>
      <Card title="تصویر هدر لابی" aside="پس‌زمینه بالای نمایشگر">
        <SharedContentStatus label="هدر لابی" {...headerStore} />
        <Note>تصویر افقی پیشنهادی: ۱۹۲۰ × ۳۴۰ پیکسل؛ JPG، PNG یا WebP، حداکثر ۱۵ مگابایت.</Note>
        <details><summary>راهنمای تصویر هدر</summary><Note>سوژه اصلی را سمت چپ بگذارید و سمت راست را برای خوش‌آمدگویی خلوت نگه دارید. تصویر با حفظ نسبت قاب را پر می‌کند و ممکن است از لبه‌ها برش بخورد؛ تصویر برای ذخیره سبک می‌شود.</Note></details>
        {headerError && <p role="alert">{headerError}</p>}
        <div className="lobby-header-actions">
          <label className="lobby-header-upload">انتخاب تصویر <input type="file" accept="image/jpeg,image/png,image/webp" disabled={headerStore.status !== "ready"} onChange={e => { void chooseHeader(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <Button disabled={headerDraft === null || headerStore.status !== "ready"} onClick={() => { if (headerDraft !== null) { headerStore.save({ image: headerDraft }); setHeaderDraft(null); } }}>ذخیره تصویر هدر</Button>
          {headerDraft !== null && <Button onClick={() => setHeaderDraft(null)}>انصراف</Button>}
          {headerStore.value.image && <Button disabled={headerStore.status !== "ready"} onClick={() => { headerStore.save({ image: "" }); setHeaderDraft(null); }}>بازگشت به هدر قبلی</Button>}
        </div>
        <Note>پس از ذخیره، تصویر در نمایشگر لابی نیز به‌روزرسانی می‌شود. پوسترهای اسلایدر پایین هدر جداگانه مدیریت می‌شوند.</Note>
      </Card>
      </section>
      <section hidden={tab !== "posters"} className="lobby-admin-section">
      <Card title="پوسترهای اسلایدر">
        <SharedContentStatus label="پوسترهای لابی" legacyKey="lobby.posters.v1" {...posterStore} />
        <fieldset disabled={posterProcessing || (posterStore.status !== "ready" && posterStore.status !== "saving")}>
        <Note>تصویر پیشنهادی ۱۶۰۰ × ۴۰۰ پیکسل؛ JPG، PNG یا WebP تا ۱۰ مگابایت.</Note>
        <details><summary>راهنمای تصویر و زمان‌بندی</summary><Note>
          <b>راهنمای تصویر اسلایدر:</b> اندازه پیشنهادی ۱۶۰۰ × ۴۰۰ پیکسل (افقی، نسبت حدود ۴ به ۱) است؛ اندازه دقیق قاب با نمایشگر تغییر می‌کند. فرمت JPG، PNG یا WebP و حجم فایل اولیه حداکثر ۱۰ مگابایت باشد. تصویر به‌صورت خودکار به WebP سبک و حداکثر حدود ۲۲۰ کیلوبایت تبدیل می‌شود. تصویر کامل و بدون کشیدگی نمایش داده می‌شود و فضای اضافه با نسخه محو همان تصویر پر می‌شود. متن و لوگو را درشت و با فاصله از لبه‌ها قرار دهید. مجموع اطلاعات همه پوسترها حداکثر حدود ۲ مگابایت است.
        </Note><Note>
          <b>زمان‌بندی:</b> هر پوستر «مدت نمایش» (ثانیه) خودش را دارد؛ عدد را تغییر دهید تا همان پوستر کوتاه‌تر یا بلندتر بماند (حداقل ۳ ثانیه). اسلایدر به‌ترتیب جدول جابه‌جا می‌شود و برای جابه‌جایی از ▶ ◀ استفاده کنید. با تاریخ شروع و پایان، پوستر خودکار در بازه‌ی خودش نمایش داده و بعد از آن کنار گذاشته می‌شود. «نمایش» را خاموش کنید تا بدون حذف پنهان شود. اگر فقط یک پوستر فعال باشد ثابت می‌ماند و اگر هیچ‌کدام فعال نباشد، تصویر پیش‌فرض نشان داده می‌شود.
        </Note></details>
        <div style={{ margin: "12px 0" }}>
          <label className="lobby-header-upload">
            + بارگذاری پوستر
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
        {posterMessage && <p role="status">{posterMessage}</p>}
        {posters.length === 0 ? <p>هنوز پوستری بارگذاری نشده است.</p> : <div className="lobby-poster-list">{posters.map((poster, index) => <article className="lobby-poster-card" key={poster.id}>
          <img src={poster.image} alt="" />
          <div className="lobby-poster-details"><div className="lobby-poster-heading"><strong>{poster.title || "پوستر بدون عنوان"}</strong><span>{posterStatus(poster, today)}</span></div>
            <div className="lobby-poster-controls"><label>عنوان<input className="wd-search" value={poster.title} onChange={event => patch(poster.id, { title: event.target.value })} /></label><label>مدت نمایش (ثانیه)<input className="wd-search" type="number" min={3} max={3600} value={poster.seconds} onChange={event => patch(poster.id, { seconds: Math.min(3600, Math.max(3, Number(event.target.value) || 3)) })} /></label><label className="lobby-poster-check"><input type="checkbox" checked={!!poster.permanent} onChange={event => patch(poster.id, { permanent: event.target.checked })} /> همیشگی</label></div>
            {!poster.permanent && <div className="lobby-poster-dates"><label>شروع<JalaliDateInput label={`شروع ${poster.title}`} value={poster.start} onChange={value => patch(poster.id, { start: value })} /></label><label>پایان<JalaliDateInput label={`پایان ${poster.title}`} value={poster.end} onChange={value => patch(poster.id, { end: value })} /></label></div>}
            <div className="lobby-poster-actions"><label>نمایش <Toggle label={`نمایش ${poster.title}`} on={poster.on} onChange={() => patch(poster.id, { on: !poster.on })} /></label><button className="lb-mv" disabled={index === 0} onClick={() => movePoster(index, -1)} aria-label={`انتقال ${poster.title} به قبل`}>▶</button><button className="lb-mv" disabled={index === posters.length - 1} onClick={() => movePoster(index, 1)} aria-label={`انتقال ${poster.title} به بعد`}>◀</button><Button size="sm" onClick={() => { if (confirm(`پوستر «${poster.title}» حذف شود؟`)) savePosters(posters.filter(item => item.id !== poster.id)); }}>حذف</Button></div>
          </div>
        </article>)}</div>}
        <Note>«ثابت» یعنی پوستر تاریخ شروع و پایان ندارد و همیشه در چرخش می‌ماند (تا وقتی خاموش یا حذف نکنید). بقیه فقط در بازه‌ی تاریخ خودشان نمایش داده می‌شوند.</Note>
        <Note>تنظیمات روی سرور ذخیره و در نمایشگر لابی به‌روزرسانی می‌شود.</Note>
        </fieldset>
      </Card>
      </section>
      <section hidden={tab !== "content"} className="lobby-admin-section">
      <Card title="کارت‌های لابی">
        <SharedContentStatus label="کارت‌های لابی" legacyKey="lobby.cards.v1" {...cardStore} />
        <fieldset disabled={cardStore.status !== "ready" && cardStore.status !== "saving"}>
        <div className="lobby-table-wrap"><DataTable
          columns={["کارت", "نمایش", "ترتیب", "عملیات"]}
          rows={cards.map((c, i) => [
            c.title,
            <Toggle key="t" label={c.title} on={c.on} onChange={() => save(cards.map((x) => (x.id === c.id ? { ...x, on: !x.on } : x)))} />,
            <div key="o" style={{ display: "flex", gap: 6 }}>
              <button className="lb-mv" onClick={() => move(i, -1)} aria-label="راست">▶</button>
              <button className="lb-mv" onClick={() => move(i, 1)} aria-label="چپ">◀</button>
            </div>,
            c.kind === "custom"
              ? <Button key="d" size="sm" onClick={() => { if (confirm(`کارت «${c.title}» حذف شود؟`)) save(cards.filter((x) => x.id !== c.id)); }}>حذف</Button>
              : <span key="d">—</span>,
          ])}
        /></div>
        <div className="lobby-form-panel">
          <b>افزودن کارت جدید</b>
          <label>عنوان کارت<input className="wd-search" placeholder="عنوان کارت" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></label>
          <label>متن کارت<textarea className="wd-search" rows={3} placeholder="متن کارت" value={newText} onChange={(e) => setNewText(e.target.value)} /></label>
          <div><Button variant="primary" onClick={addCard}>افزودن کارت</Button></div>
        </div>
        <Note>خاموش کردن کارت محتوا را حذف نمی‌کند. تنظیمات روی سرور ذخیره می‌شوند.</Note>
        </fieldset>
      </Card>

      <Card title="اطلاعیه‌ها"><p>ثبت و مدیریت اطلاعیه‌ها در بخش روابط عمومی انجام می‌شود.</p><a href="/announcements/manage">رفتن به مدیریت اطلاعیه‌ها ←</a></Card>
      </section>
      </div>
    </AppShell>
  );
}
