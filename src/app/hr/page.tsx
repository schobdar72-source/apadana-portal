"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageFrame } from "@/components/PageFrame";
import { can } from "@/config/roles";
import { useMe } from "@/services/useMe";
import { HrContent } from "./HrContent";
import "@/styles/hr-dashboard.css";

type Profile = { code: string; firstName: string; lastName: string; unit?: string | null; location?: string | null; positionTitle?: string | null; hireDate?: string | null; status?: string | null };
type Person = { id: number; name: string; unit?: string; title?: string; label?: string };
type People = { birthdays: Person[]; hires: Person[]; scope?: string };
type Dashboard = { total: number; active: number; incomplete: number; hires: number; hireDays: number; issues: { unit: number; location: number; position: number; birthdate: number }; statuses: { name: string; count: number }[]; locations: { id: number | null; name: string; count: number }[]; locationOptions: { id: number; name: string }[]; unitOptions: { id: number; name: string }[] };
type Load<T> = { data: T | null; error: boolean };
const empty = <T,>(): Load<T> => ({ data: null, error: false });
const fa = (value: number | string) => String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const statusNames: Record<string, string> = { active: "فعال", long_leave: "مرخصی بلندمدت", left: "ترک کار", retired: "بازنشسته", contract_ended: "پایان قرارداد" };

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 20c.4-3.8 2.6-5.5 6-5.5s5.6 1.7 6 5.5M16 5.5a3 3 0 0 1 0 5.8M17 14.5c2.5.3 3.7 2 4 4.5"/></>,
    file: <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></>,
    chart: <><path d="M4 20h16M6 17v-5M11 17V7M16 17v-8M4 7l5-3 4 2 6-4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/></>,
    phone: <path d="M6 3l3 4-2 2c1.5 3 3 4.5 6 6l2-2 4 3-1 3c-.3 1-1.3 1.5-2.3 1.2C9.5 18.4 5.6 14.5 3.8 8.3 3.5 7.3 4 6.3 5 6z"/>,
    bell: <><path d="M5 17h14l-2-2V10a5 5 0 0 0-10 0v5zM10 20h4"/></>,
    gift: <><rect x="4" y="10" width="16" height="11" rx="1"/><path d="M3 7h18v3H3zM12 7v14M12 7c-5 0-5-4-2-4 2 0 2 4 2 4zm0 0c5 0 5-4 2-4-2 0-2 4-2 4z"/></>,
    org: <><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>;
}

function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return <div className="hrd-section-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div></div>;
}

function Service({ icon, title, description, href, soon }: { icon: string; title: string; description: string; href?: string; soon?: boolean }) {
  const content = <><span className="hrd-icon"><Icon name={icon} /></span><span className="hrd-service-copy"><strong>{title}</strong><small>{description}</small></span><span className={soon ? "hrd-soon" : "hrd-arrow"}>{soon ? "به‌زودی" : "←"}</span></>;
  return href && !soon ? <Link className="hrd-service" href={href}>{content}</Link> : <div className="hrd-service is-soon">{content}</div>;
}

function PeopleCard({ title, icon, rows, loading, error, scope }: { title: string; icon: string; rows?: Person[]; loading: boolean; error: boolean; scope?: string }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="hrd-card hrd-people"><div className="hrd-card-title"><span className="hrd-icon"><Icon name={icon}/></span><div><h3>{title}{rows?.length ? ` · ${fa(rows.length)} نفر` : ""}</h3><p>همکاران محل خدمت شما</p></div></div>{loading ? <p className="hrd-muted">در حال دریافت اطلاعات…</p> : error ? <p className="hrd-muted">دریافت اطلاعات ممکن نشد.</p> : scope === "location_missing" ? <p className="hrd-muted">محل خدمت شما ثبت نشده است؛ با منابع انسانی تماس بگیرید.</p> : rows?.length ? <><ul>{(expanded ? rows : rows.slice(0, 3)).map((person) => <li key={person.id}><span><b>{person.name}</b><small>{person.title || person.unit || "همکار آپادانا"}</small></span><em>{person.label}</em></li>)}</ul>{rows.length > 3 && <button type="button" className="hrd-show-more" onClick={() => setExpanded(!expanded)}>{expanded ? "نمایش کمتر" : `نمایش همه ${fa(rows.length)} نفر`}</button>}</> : <p className="hrd-muted">در محل خدمت شما و بازه نمایش، موردی وجود ندارد.</p>}</section>;
}

export default function HR() {
  const me = useMe();
  const isManager = !!me && (can(me.role, "employee.read") || can(me.role, "org.manage"));
  const [profile, setProfile] = useState<Load<Profile>>(empty);
  const [people, setPeople] = useState<Load<People>>(empty);
  const [dashboard, setDashboard] = useState<Load<Dashboard>>(empty);
  const [locationScope, setLocationScope] = useState("");
  const [unitScope, setUnitScope] = useState("");

  useEffect(() => {
    if (!me) return;
    let live = true;
    const read = async <T,>(url: string, set: (value: Load<T>) => void, extract: (value: any) => T) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      try { const response = await fetch(url); if (!response.ok) throw new Error("request failed"); const value = await response.json(); if (live) set({ data: extract(value), error: false }); }
      catch { if (live) set({ data: null, error: true }); }
    };
    void read<Profile>("/api/profile", setProfile, (value) => value.employee);
    void read<People>("/api/portal/people", setPeople, (value) => ({ birthdays: value.birthdays || [], hires: value.hires || [], scope: value.scope }));
    return () => { live = false; };
  }, [me, isManager]);

  useEffect(() => {
    if (!isManager) return;
    const controller = new AbortController();
    const params = new URLSearchParams(); if (locationScope) params.set("location", locationScope); if (unitScope) params.set("unit", unitScope);
    fetch(`/api/hr/dashboard?${params}`, { cache: "no-store", signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => setDashboard({ data, error: false })).catch(() => { if (!controller.signal.aborted) setDashboard({ data: null, error: true }); });
    return () => controller.abort();
  }, [isManager, locationScope, unitScope]);

  const p = profile.data;
  const d = dashboard.data;
  const employeesHref = (extra: Record<string, string> = {}) => { const params = new URLSearchParams(); if (locationScope) params.set("location", locationScope); if (unitScope) { params.set("unit", unitScope); params.set("exact", "1"); } Object.entries(extra).forEach(([key, value]) => params.set(key, value)); return `/hr/employees?${params}`; };
  const hiresHref = () => { const params = new URLSearchParams(); if (locationScope) params.set("location", locationScope); if (unitScope) params.set("unit", unitScope); return `/hr/hires?${params}`; };
  return <PageFrame id="hr" title="منابع انسانی" activeHref="/hr">
    <div className="hrd-page">
      <section className="hrd-hero"><div><span className="hrd-eyebrow">پرتال همکاران آپادانا</span><h1>{me ? `${me.firstName} ${me.lastName}، خوش آمدید` : "منابع انسانی"}</h1><p>{isManager ? "نمایی از وضعیت همکاران و دسترسی سریع به ابزارهای مدیریت منابع انسانی" : "خدمات و اطلاعات مورد نیاز شما، در یک نگاه"}</p></div><span className="hrd-hero-art" aria-hidden="true"><Icon name="people"/></span></section>

      {isManager && <section aria-label="نمای مدیریت منابع انسانی"><SectionHeading title="نمای مدیریت" detail="آمار کل سازمان؛ فیلترها مستقل از محل خدمت حساب شما هستند."/>
        <div className="hrd-scope"><label>محل خدمت<select value={locationScope} onChange={e => setLocationScope(e.target.value)}><option value="">کل سازمان</option>{d?.locationOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}<option value="missing">ثبت نشده</option></select></label><label>واحد سازمانی<select value={unitScope} onChange={e => setUnitScope(e.target.value)}><option value="">همه واحدها</option>{d?.unitOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}<option value="missing">ثبت نشده</option></select></label><span>فقط واحد انتخاب‌شده؛ بدون زیرواحدها</span></div>
        {dashboard.error ? <div className="hrd-card hrd-error" role="status">دریافت آمار مدیریتی ممکن نشد. لطفاً صفحه را دوباره باز کنید.</div> : <div className="hrd-stats">
          {[{ title: "کل پرونده‌ها", value: d?.total, icon: "file", href: employeesHref() }, { title: "همکاران فعال", value: d?.active, icon: "people", href: employeesHref({ active: "1" }) }, { title: "پرونده نیازمند تکمیل", value: d?.incomplete, icon: "chart", href: employeesHref({ issue: "all" }) }, { title: "همکاران جدید در محدوده", value: d?.hires, icon: "user", href: hiresHref() }].map((item) => <Link href={item.href} className="hrd-stat" key={item.title}><span className="hrd-icon"><Icon name={item.icon}/></span><span><small>{item.title}</small><b>{item.value === undefined ? "—" : fa(item.value)}</b>{item.title === "همکاران جدید در محدوده" && <small>{d ? `${fa(d.hireDays)} روز اخیر` : "در بازه تنظیم‌شده"}</small>}</span><span className="hrd-arrow">←</span></Link>)}
        </div>}
        <p className="hrd-caption">همکار فعال یعنی وضعیت همکاری فعال و حساب فعال. پرونده نیازمند تکمیل: همکار فعال بدون واحد، محل خدمت یا عنوان شغلی.</p>
        <section className="hrd-attention"><h2>اقدامات نیازمند توجه</h2><p>اطلاعات ناقص کارکنان فعال در محدوده انتخابی؛ هر پرونده ممکن است در چند مورد شمرده شود.</p><div>{([{ key: "location", label: "بدون محل خدمت" }, { key: "unit", label: "بدون واحد" }, { key: "position", label: "بدون عنوان شغلی" }, { key: "birthdate", label: "تاریخ تولد ناقص" }] as const).map(item => <Link key={item.key} href={employeesHref({ issue: item.key })}><span>{item.label}</span><strong>{d ? fa(d.issues[item.key]) : "—"}</strong></Link>)}</div></section>
        <div className="hrd-admin-grid"><section className="hrd-card"><SectionHeading title="همکاران فعال بر اساس محل خدمت"/><div className="hrd-breakdown">{dashboard.error ? <p className="hrd-muted">آمار در دسترس نیست.</p> : !d ? <p className="hrd-muted">در حال دریافت آمار…</p> : d.locations.length ? d.locations.map((item) => <Link key={item.name} href={employeesHref({ location: item.id == null ? "missing" : String(item.id), active: "1" })}><span>{item.name}</span><strong>{fa(item.count)}</strong></Link>) : <p className="hrd-muted">داده‌ای ثبت نشده است.</p>}</div></section>
          <section className="hrd-card"><SectionHeading title="وضعیت همکاری"/><div className="hrd-breakdown">{dashboard.error ? <p className="hrd-muted">آمار در دسترس نیست.</p> : !d ? <p className="hrd-muted">در حال دریافت آمار…</p> : d.statuses.length ? d.statuses.map((item) => <div key={item.name}><span>{statusNames[item.name] || item.name}</span><strong>{fa(item.count)}</strong></div>) : <p className="hrd-muted">داده‌ای ثبت نشده است.</p>}</div></section></div>
        <SectionHeading title="ابزارهای مدیریت"/><div className="hrd-services hrd-management"><Service icon="file" title="پرونده کارکنان" description="مشاهده و مدیریت اطلاعات همکاران" href="/hr/employees"/><Service icon="org" title="ساختار سازمانی" description="مدیریت واحدها و محل خدمت" href="/hr/org"/><Service icon="chart" title="چارت سازمانی" description="مشاهده ساختار سازمان" href="/hr/org/chart"/><Service icon="gift" title="تولد همکاران" description="مدیریت نمایش تولدها" href="/hr/birthdays"/><Service icon="people" title="استخدام‌های جدید" description="مدیریت نمایش همکاران جدید" href="/hr/hires"/></div>
      </section>}

      <SectionHeading title="اطلاعات و خدمات من" detail="دسترسی سریع به خدمات پرسنلی"/>
      <div className="hrd-personal-grid"><section className="hrd-card hrd-profile"><div className="hrd-card-title"><span className="hrd-icon"><Icon name="user"/></span><div><h3>پروفایل من</h3><p>خلاصه اطلاعات شغلی شما</p></div></div>{profile.error ? <p className="hrd-muted">دریافت اطلاعات پروفایل ممکن نشد.</p> : p ? <><div className="hrd-profile-person"><span className="hrd-profile-avatar"><Icon name="user"/></span><div><h4>{p.firstName} {p.lastName}</h4><p>{p.positionTitle || "عنوان شغلی ثبت نشده"}</p><small>{p.unit || "واحد سازمانی ثبت نشده"}</small></div><span className="hrd-profile-art" aria-hidden="true"><Icon name="people"/></span></div><div className="hrd-profile-meta"><span>کد پرسنلی <b>{fa(p.code)}</b></span><span>محل خدمت <b>{p.location || "ثبت نشده"}</b></span><span>تاریخ استخدام <b>{p.hireDate ? fa(p.hireDate) : "ثبت نشده"}</b></span><span>وضعیت همکاری <b>{p.status ? statusNames[p.status] || p.status : "ثبت نشده"}</b></span></div></> : <p className="hrd-muted">در حال دریافت اطلاعات…</p>}<div className="hrd-profile-footer"><Link className="hrd-button" href="/profile">مشاهده پروفایل کامل <span>←</span></Link><small>برای اصلاح اطلاعات، با منابع انسانی تماس بگیرید.</small></div></section>
        <HrContent manager={!!me && can(me.role, "org.manage")} /></div>
      <div className="hrd-services"><Service icon="phone" title="دفترچه تلفن" description="دسترسی به شماره همکاران" href="/phonebook"/></div>
      <details className="hrd-upcoming"><summary>خدمات در دست ساخت <span>۶ خدمت · به‌زودی</span></summary><div className="hrd-services"><Service icon="calendar" title="حضور و غیاب" description="مشاهده اطلاعات تردد" soon/><Service icon="calendar" title="درخواست مرخصی" description="ثبت و پیگیری درخواست" soon/><Service icon="file" title="فیش حقوقی" description="مشاهده اسناد حقوقی" soon/><Service icon="file" title="گواهی اشتغال" description="ثبت و پیگیری درخواست" soon/><Service icon="file" title="درخواست به منابع انسانی" description="ثبت و پیگیری درخواست‌ها" soon/><Service icon="user" title="بیمه تکمیلی" description="خدمات و اطلاعات بیمه همکاران" soon/></div></details>
      <SectionHeading title="همکاران ما" detail="همکاران محل خدمت شما بر اساس تنظیمات نمایش پرتال"/><div className="hrd-people-grid"><PeopleCard title="تولد همکاران" icon="gift" rows={people.data?.birthdays} loading={!people.data && !people.error} error={people.error} scope={people.data?.scope}/><PeopleCard title="همکاران جدید" icon="people" rows={people.data?.hires} loading={!people.data && !people.error} error={people.error} scope={people.data?.scope}/></div>
    </div>
  </PageFrame>;
}
