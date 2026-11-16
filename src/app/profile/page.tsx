"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Input, Note } from "@/components/ui";
import { roleLabel } from "@/services/useMe";
import { ProfileRows as Rows } from "@/components/ProfileRows";
import "@/styles/profile.css";

type Profile = Record<string, unknown> & {
  code: string; firstName: string; lastName: string; role: string;
  unit?: string; location?: string; positionTitle?: string;
};

const fa = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return s.trim() === "" ? "" : s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
};
const GENDER: Record<string, string> = { male: "مرد", female: "زن" };
const MARITAL: Record<string, string> = { single: "مجرد", married: "متأهل" };
const EDUCATION: Record<string, string> = { diploma: "دیپلم", associate: "کاردانی", bachelor: "کارشناسی", master: "کارشناسی ارشد", phd: "دکتری", other: "سایر" };
const CONTRACT: Record<string, string> = { official: "رسمی", contractual: "پیمانی", fixed: "قرارداد معین", company: "شرکتی" };
const STATUS: Record<string, string> = { active: "فعال", long_leave: "مرخصی بلندمدت", left: "ترک کار", retired: "بازنشسته", contract_ended: "پایان قرارداد" };
const label = (map: Record<string, string>, v: unknown) => (v ? map[String(v)] ?? String(v) : "");

function PasswordField({ label: name, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="profile-password-field"><Input label={name} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} /><button className="profile-password-toggle" type="button" aria-label={`${visible ? "پنهان کردن" : "نمایش"} ${name}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "پنهان" : "نمایش"}</button></div>;
}

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordRules: [string, boolean][] = [["حداقل ۸ کاراکتر", next.length >= 8], ["شامل حروف انگلیسی و عدد", /[A-Za-z]/.test(next) && /[0-9]/.test(next)], ["متفاوت از کد پرسنلی", !!next && next !== p?.code]];

  useEffect(() => {
    fetch("/api/profile").then(async (r) => {
      if (!r.ok) { setLoadErr(r.status === 401 ? "برای دیدن این صفحه وارد شوید." : "خطا در بارگذاری اطلاعات."); return; }
      setP((await r.json()).employee);
    }).catch(() => setLoadErr("خطا در بارگذاری اطلاعات."));
  }, []);

  const changePass = async () => {
    setPwErr(""); setPwMsg("");
    if (!current || !next) { setPwErr("رمز فعلی و رمز جدید را وارد کنید."); return; }
    if (next !== next2) { setPwErr("تکرار رمز جدید یکسان نیست."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setPwErr(j.error || "تغییر رمز انجام نشد.");
      else { setPwMsg("رمز عبور تغییر کرد."); setCurrent(""); setNext(""); setNext2(""); }
    } catch { setPwErr("خطا در ارتباط با سرور."); }
    setBusy(false);
  };

  return (
    <AppShell title="پروفایل من" activeHref="/profile">
      {loadErr && <Note>{loadErr}</Note>}
      {!p && !loadErr && <Note>در حال بارگذاری…</Note>}
      {p && (
        <div className="profile-page">
          <section className="profile-hero" aria-label="معرفی کاربر">
            <div className="profile-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c.7-4 3.5-6 7.5-6s6.8 2 7.5 6z"/></svg>
            </div>
            <div className="profile-identity">
              <span className="profile-eyebrow">پروفایل همکار</span>
              <h1>{p.firstName} {p.lastName}</h1>
              <p>{p.positionTitle || "عنوان شغلی ثبت نشده"} <span aria-hidden="true">·</span> {p.unit || "واحد سازمانی ثبت نشده"}</p>
            </div>
            <div className="profile-hero-meta"><span>کد پرسنلی</span><strong>{fa(p.code)}</strong><small>{roleLabel(p.role)}</small></div>
          </section>
          <p className="profile-notice">برای اصلاح اطلاعات پرونده، با منابع انسانی تماس بگیرید.</p>

          <div className="profile-cards">
          <Rows title="هویت و استخدام" rows={[
            { label: "کد پرسنلی", value: fa(p.code) },
            { label: "عنوان شغلی", value: fa(p.positionTitle) },
            { label: "واحد سازمانی", value: fa(p.unit) },
            { label: "محل خدمت", value: fa(p.location) },
            { label: "نوع قرارداد", value: label(CONTRACT, p.contractType) },
            { label: "وضعیت", value: label(STATUS, p.status), status: String(p.status || "") },
            { label: "تاریخ استخدام", value: fa(p.hireDate) },
            { label: "نقش در پرتال", value: roleLabel(p.role) },
          ]} />

          <Rows title="اطلاعات شخصی" rows={[
            { label: "نام پدر", value: fa(p.fatherName) },
            { label: "جنسیت", value: label(GENDER, p.gender) },
            { label: "کد ملی", value: fa(p.nationalId), sensitive: true },
            { label: "شماره شناسنامه", value: fa(p.birthCertNo), sensitive: true },
            { label: "تاریخ تولد", value: fa(p.birthDate) },
            { label: "محل تولد", value: fa(p.birthPlace) },
            { label: "وضعیت تأهل", value: label(MARITAL, p.maritalStatus) },
            { label: "تحصیلات", value: label(EDUCATION, p.education) },
            { label: "رشته‌ی تحصیلی", value: fa(p.fieldOfStudy) },
          ]} />

          <Rows title="راه تماس" wide rows={[
            { label: "موبایل", value: fa(p.mobile), ltr: true },
            { label: "ایمیل", value: String(p.email || ""), ltr: true },
            { label: "نشانی", value: fa(p.address), wide: true },
          ]} />

          <section className="profile-security" aria-label="امنیت حساب">
            <Card title="امنیت حساب · تغییر رمز عبور">
              <p className="profile-security-help">رمز جدید باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد و با کد پرسنلی تفاوت داشته باشد.</p>
              <form onSubmit={(event) => { event.preventDefault(); void changePass(); }}>
                <div className="profile-password-fields">
                  <PasswordField label="رمز فعلی" autoComplete="current-password" value={current} onChange={setCurrent} />
                  <PasswordField label="رمز جدید" autoComplete="new-password" value={next} onChange={setNext} />
                  <PasswordField label="تکرار رمز جدید" autoComplete="new-password" value={next2} onChange={setNext2} />
                </div>
                {next && <ul className="profile-password-rules" aria-label="شرط‌های رمز جدید">{passwordRules.map(([rule, valid]) => <li key={rule} className={valid ? "is-met" : ""}>{valid ? "✓" : "○"} {rule}</li>)}</ul>}
                <div className="profile-actions">
                  <Button type="submit" variant="primary" disabled={busy}>{busy ? "در حال ذخیره…" : "تغییر رمز"}</Button>
                  {pwErr && <span className="profile-error" role="alert">{pwErr}</span>}
                  {!pwErr && pwMsg && <span className="profile-success" role="status">{pwMsg}</span>}
                </div>
              </form>
            </Card>
          </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
