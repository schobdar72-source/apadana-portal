"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePageCfg } from "@/services/pageCfg";
import "@/styles/login.css";
import { defaultLoginSettings, validLoginSettings } from "@/config/login";
import { useSharedPortalStore } from "@/services/sharedPortalStore";
import { normalizeEmployeeCode, safeLoginDestination } from "@/lib/loginInput";

function Form() {
  const { cfg } = usePageCfg("login");
  const { value: savedLogin } = useSharedPortalStore("login", defaultLoginSettings);
  const loginSettings = validLoginSettings(savedLogin) ? savedLogin : defaultLoginSettings;
  const safeImage = (loginSettings.image.startsWith("/") && !loginSettings.image.startsWith("//")) || /^https:\/\//i.test(loginSettings.image) || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(loginSettings.image) ? loginSettings.image : "";
  const q = useSearchParams();
  const [step, setStep] = useState<"login" | "change">("login");
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [invalid, setInvalid] = useState<"code" | "pass" | "np" | "np2" | null>(null);

  const go = () => {
    window.location.href = safeLoginDestination(q.get("next"));
  };
  const post = async (url: string, body: unknown) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error || "خطا در ارتباط با سرور."); return null; }
      return j;
    } catch { setMsg("خطا در ارتباط با سرور."); return null; }
    finally { setBusy(false); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setInvalid(null);
    if (step === "login") {
      if (!code.trim() || !pass) { setInvalid(!code.trim() ? "code" : "pass"); setMsg("کد پرسنلی و رمز عبور را وارد کنید."); return; }
      const j = await post("/api/auth/login", { code: normalizeEmployeeCode(code), password: pass });
      if (!j) return;
      if (j.mustChangePass) { setStep("change"); setMsg(""); } else go();
    } else {
      if (np.length < 8 || !/[A-Za-z]/.test(np) || !/[0-9]/.test(np)) { setInvalid("np"); setMsg("رمز جدید باید حداقل ۸ کاراکتر و شامل حروف انگلیسی و عدد انگلیسی باشد."); return; }
      if (np !== np2) { setInvalid("np2"); setMsg("تکرار رمز جدید یکسان نیست."); return; }
      const j = await post("/api/auth/password", { current: pass, next: np });
      if (j) go();
    }
  };
  return (
    <main className="portal-login" dir="rtl" style={cfg.accent ? ({ "--login-accent": cfg.accent } as React.CSSProperties) : undefined}>
      <div className="portal-login-shell">
      <section className="portal-login-visual" aria-label="پرتال آپادانا کاوش ایرانیان" style={safeImage ? { backgroundImage: `url(${JSON.stringify(safeImage)})` } : undefined}>
        <div className="portal-login-brand"><img src="/brand/logo.svg" alt="لوگوی آپادانا کاوش" /><div><b>آپادانا کاوش ایرانیان</b><span>شرکت مهندسی و معدن‌کاری روباز</span></div></div>
        <div className="portal-login-visual-copy"><span>پرتال سازمانی آپادانا</span><h2>{loginSettings.message || defaultLoginSettings.message}</h2><p>دسترسی یکپارچه به خدمات و سامانه‌های سازمان</p></div>
        <div className="portal-login-visual-foot">مهندسی، تلاش و همراهی در مسیر توسعه</div>
      </section>
      <form className="portal-login-form" onSubmit={submit}>
        <Link href="/" className="portal-login-back">← بازگشت به پرتال</Link>
        <div className="portal-login-heading"><span className="portal-login-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3" strokeLinecap="round"/></svg></span><span>حساب کاربری سازمانی</span><h1>{step === "login" ? "خوش آمدید" : "تعویض رمز عبور"}</h1><p>{step === "login" ? "برای ورود به پرتال، اطلاعات کاربری خود را وارد کنید." : "برای ادامه، رمز عبور جدید خود را ثبت کنید."}</p></div>
        {step === "login" ? (
          <>
            <label>کد پرسنلی یا نام کاربری<input value={code} onChange={(e) => { setCode(e.target.value); setInvalid(null); }} aria-invalid={invalid === "code"} autoComplete="username" placeholder="کد پرسنلی یا نام کاربری خود را وارد کنید" /></label>
            <label>رمز عبور<span className="portal-login-password"><input type={showPassword ? "text" : "password"} value={pass} onChange={(e) => { setPass(e.target.value); setInvalid(null); }} aria-invalid={invalid === "pass"} autoComplete="current-password" placeholder="رمز عبور خود را وارد کنید" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}>{showPassword ? "پنهان" : "نمایش"}</button></span></label>
          </>
        ) : (
          <>
            <p className="portal-login-hint" id="password-requirements">رمز عبور باید حداقل ۸ کاراکتر و شامل حروف انگلیسی و عدد انگلیسی باشد و با کد پرسنلی یکسان نباشد.</p>
            <label>رمز جدید<input type="password" value={np} onChange={(e) => { setNp(e.target.value); setInvalid(null); }} aria-invalid={invalid === "np"} aria-describedby="password-requirements" autoComplete="new-password" /></label>
            <label>تکرار رمز جدید<input type="password" value={np2} onChange={(e) => { setNp2(e.target.value); setInvalid(null); }} aria-invalid={invalid === "np2"} autoComplete="new-password" /></label>
          </>
        )}
        {step === "login" && <><button className="portal-login-recovery" type="button" onClick={() => setShowRecovery(!showRecovery)} aria-expanded={showRecovery}>رمز عبور را فراموش کرده‌اید؟</button>{showRecovery && <p className="portal-login-hint">{loginSettings.support ? `برای بازیابی رمز با پشتیبانی سازمان تماس بگیرید: ${loginSettings.support}` : "برای بازیابی رمز، با پشتیبانی سازمان تماس بگیرید."}</p>}</>}
        {msg && <p className="portal-login-error" role="alert">{msg}</p>}
        <button className="portal-login-submit" type="submit" disabled={busy}>{busy ? "در حال بررسی…" : step === "login" ? "ورود به پرتال" : "ثبت رمز جدید"}<span aria-hidden="true">←</span></button>
        <p className="portal-login-help">{loginSettings.support ? `پشتیبانی ورود: ${loginSettings.support}` : "برای دریافت راهنمایی ورود و بازیابی رمز، با پشتیبانی سازمان تماس بگیرید."}</p>
      </form>
      </div>
    </main>
  );
}

export default function Login() {
  return <Suspense><Form /></Suspense>;
}
