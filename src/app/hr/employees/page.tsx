"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageFrame } from "@/components/PageFrame";
import { PickSelect } from "@/components/PickSelect";
import { JalaliTextDate } from "@/components/JalaliTextDate";
import { RANKS } from "@/lib/orgRanks";
import { ROLES } from "@/config/roles";
import { Badge, Button, Card, Input, Note } from "@/components/ui";
import { ImportExport } from "./ImportExport";
import { validBirthDate } from "@/lib/hrCompleteness";
import "@/styles/employee-directory.css";

type Row = { id: number; code: string; firstName: string; lastName: string; active: boolean; status: string; contractType: string | null; mobile: string | null; email: string | null; positionTitle: string | null; positionRank: number | null; unitId: number | null; locationId: number | null; birthDate: string | null; hireDate: string | null };
type Opt = { id: number; name: string; parentId?: number | null; locationId?: number | null };
type F = Record<string, string>;

const OPTS: Record<string, [string, string][]> = {
  gender: [["male", "مرد"], ["female", "زن"]],
  maritalStatus: [["single", "مجرد"], ["married", "متأهل"]],
  education: [["diploma", "دیپلم"], ["associate", "کاردانی"], ["bachelor", "کارشناسی"], ["master", "کارشناسی ارشد"], ["phd", "دکتری"], ["other", "سایر"]],
  contractType: [["official", "رسمی"], ["contractual", "پیمانی"], ["fixed", "قرارداد معین"], ["company", "شرکتی"]],
  status: [["active", "فعال"], ["long_leave", "مرخصی بلندمدت"], ["left", "ترک کار"], ["retired", "بازنشسته"], ["contract_ended", "پایان قرارداد"]],
};
const STATUS = Object.fromEntries(OPTS.status);
const CONTRACT = Object.fromEntries(OPTS.contractType);
const ROLE_OPTS: [string, string][] = Object.entries(ROLES).map(([k, r]) => [k, r.label]);
const ENDED = ["left", "retired", "contract_ended"]; // وضعیت‌هایی که یعنی پایان همکاری
const TONE: Record<string, "ok" | "warn" | "info" | "default"> = { active: "ok", long_leave: "info", left: "warn", retired: "warn", contract_ended: "warn" };
const PAGE = 50;

// اعتبارسنجی سمت کلاینت (سرور هم بررسی می‌کند)
function checkForm(f: F, isNew: boolean): string | null {
  if ((isNew && !f.code?.trim()) || !f.firstName?.trim() || !f.lastName?.trim()) return "کد پرسنلی، نام و نام خانوادگی الزامی است.";
  if (f.nationalId && !/^\d{10}$/.test(f.nationalId)) return "کد ملی باید دقیقاً ۱۰ رقم باشد.";
  if (f.mobile && !/^09\d{9}$/.test(f.mobile)) return "شماره موبایل باید با 09 شروع و ۱۱ رقم باشد.";
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return "ایمیل نامعتبر است.";
  for (const [key, label] of [["birthDate", "تاریخ تولد"], ["hireDate", "تاریخ استخدام"], ["endDate", "تاریخ پایان همکاری"]]) if (f[key] && !validBirthDate(f[key])) return `${label} معتبر نیست.`;
  if (ENDED.includes(f.status) && !f.endDate) return "برای پایان همکاری، تاریخ پایان را وارد کنید.";
  return null;
}

const TABS = ["اطلاعات شخصی", "استخدام و پایان همکاری", "واحد سازمانی"] as const;
type Field = [string, string, string?];
const PERSONAL: Field[] = [["firstName", "نام"], ["lastName", "نام خانوادگی"], ["fatherName", "نام پدر"], ["gender", "جنسیت", "sel"], ["nationalId", "کد ملی"], ["birthCertNo", "شماره شناسنامه"], ["birthDate", "تاریخ تولد"], ["birthPlace", "محل تولد"], ["maritalStatus", "وضعیت تأهل", "sel"], ["education", "تحصیلات", "sel"], ["fieldOfStudy", "رشته‌ی تحصیلی"], ["mobile", "موبایل"], ["email", "ایمیل"], ["address", "نشانی", "area"]];
const EMPLOY: Field[] = [["hireDate", "تاریخ استخدام"], ["contractType", "نوع قرارداد", "sel"], ["status", "وضعیت", "sel"]];
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12 } as const;

export default function EmployeesPage() {
  const [q, setQ] = useState("");
  const [unitF, setUnitF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [contractF, setContractF] = useState("");
  const [locationF, setLocationF] = useState("");
  const [issueF, setIssueF] = useState("");
  const [activeF, setActiveF] = useState(false);
  const [exactUnit, setExactUnit] = useState(false);
  const [page, setPage] = useState(0);
  const [list, setList] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const loadRequest = useRef(0);
  const [units, setUnits] = useState<Opt[]>([]);
  const [locs, setLocs] = useState<Opt[]>([]);
  const [f, setF] = useState<F | null>(null); // فرم باز
  const [openId, setOpenId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tab, setTab] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [denied, setDenied] = useState(false);
  const [showIO, setShowIO] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const baseline = useRef("");
  const dirty = !!f && JSON.stringify(f) !== baseline.current;
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    try {
      const r = await fetch(`/api/hr/employees?q=${encodeURIComponent(q)}`);
      if (r.status === 401 || r.status === 403) { setDenied(true); return; }
      if (!r.ok) throw new Error();
      const j = await r.json();
      if (request === loadRequest.current) { setList(j.list); setUnits(j.units); setLocs(j.locations); setTotal(j.total); setLoadError(""); }
    } catch { if (request === loadRequest.current) setLoadError("دریافت فهرست کارکنان ممکن نشد؛ اتصال را بررسی کنید."); }
  }, [q]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("open"));
    setLocationF(params.get("location") || ""); setUnitF(params.get("unit") || ""); setIssueF(params.get("issue") || ""); setActiveF(params.get("active") === "1"); setExactUnit(params.get("exact") === "1");
    if (id) open(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => setPage(0), [q, unitF, statusF, contractF, locationF, issueF, activeF]);

  const unitPath = (u: Opt) => {
    const parts = [u.name];
    let p = units.find((x) => x.id === u.parentId);
    for (let i = 0; p && i < 20; i++) { parts.unshift(p.name); p = units.find((x) => x.id === p!.parentId); }
    return parts.join(" › ");
  };
  // واحد انتخاب‌شده و تمام زیرمجموعه‌هایش
  const unitScope = useMemo(() => {
    if (!unitF || unitF === "missing") return null;
    const ids = new Set<number>([Number(unitF)]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const u of units) if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) { ids.add(u.id); grew = true; }
    }
    return ids;
  }, [unitF, units]);

  const filtered = useMemo(() => list.filter((r) =>
    (unitF !== "missing" || r.unitId == null) && (!unitScope || (r.unitId != null && (exactUnit ? r.unitId === Number(unitF) : unitScope.has(r.unitId)))) &&
    (!locationF || (locationF === "missing" ? r.locationId == null : r.locationId === Number(locationF))) &&
    (!activeF || (r.active && r.status === "active")) &&
    (!issueF || (r.active && r.status === "active" && (issueF === "all" ? r.unitId == null || r.locationId == null || !r.positionTitle?.trim() || !validBirthDate(r.hireDate) : issueF === "unit" ? r.unitId == null : issueF === "location" ? r.locationId == null : issueF === "position" ? !r.positionTitle?.trim() : issueF === "birthdate" ? !validBirthDate(r.birthDate) : issueF === "hiredate" ? !validBirthDate(r.hireDate) : true))) &&
    (!statusF || r.status === statusF) &&
    (!contractF || r.contractType === contractF)
  ), [list, unitScope, unitF, exactUnit, statusF, contractF, locationF, issueF, activeF]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const filtersOn = !!(q || unitF || statusF || contractF || locationF || issueF || activeF);
  const resetFilters = () => { setQ(""); setUnitF(""); setStatusF(""); setContractF(""); setLocationF(""); setIssueF(""); setActiveF(false); setExactUnit(false); };

  const unitName = (id: number | null) => { const unit = units.find(x => x.id === id); return unit ? unitPath(unit) : "—"; };
  const mayLeave = () => !dirty || window.confirm("تغییرات ذخیره نشده‌اند. از پرونده خارج شوید؟");
  const showForm = () => requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const open = async (id: number) => {
    if (!mayLeave()) return;
    setErr("");
    try {
      const response = await fetch(`/api/hr/employees?id=${id}`); if (!response.ok) throw new Error();
      const j = await response.json(); const o: F = {};
      for (const [k, v] of Object.entries(j.employee)) o[k] = v == null ? "" : String(v);
      baseline.current = JSON.stringify(o); setF(o); setOpenId(id); setIsNew(false); setMsg(""); setTab(0); showForm();
    } catch { setLoadError("باز کردن پرونده ممکن نشد؛ دوباره تلاش کنید."); }
  };
  const startNew = () => { if (!mayLeave()) return; const initial = { status: "active", role: "employee" }; baseline.current = JSON.stringify(initial); setF(initial); setOpenId(null); setIsNew(true); setMsg(""); setErr(""); setTab(0); showForm(); };
  const close = (force = false) => { if (!force && !mayLeave()) return; setF(null); setOpenId(null); setErr(""); };

  const set = (k: string, v: string) => setF((p) => ({ ...p!, [k]: v }));
  // منبع حقیقت: وضعیت. تیک «پایان همکاری» همان وضعیت «ترک کار» را تنظیم می‌کند.
  const setStatus = (v: string) => setF((p) => ({ ...p!, status: v, ...(v === "active" ? { endDate: "", endReason: "" } : {}) }));
  const endOn = ENDED.includes(f?.status ?? "");
  const toggleEnd = (on: boolean) => setF((p) => on
    ? { ...p!, status: ENDED.includes(p!.status) ? p!.status : "left" }
    : { ...p!, status: "active", endDate: "", endReason: "" });

  const save = async () => {
    const bad = checkForm(f!, isNew);
    if (bad) { setErr(bad); setMsg(""); if (/استخدام|پایان همکاری/.test(bad)) setTab(1); else setTab(0); return; }
    setErr("");
    setSaving(true);
    try {
      const r = await fetch("/api/hr/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "ذخیره اطلاعات ممکن نشد."); return; }
      setMsg("ذخیره شد."); baseline.current = JSON.stringify(f);
      if (isNew) close(true);
      await load();
    } catch { setErr("ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید."); }
    finally { setSaving(false); }
  };

  if (denied) return <PageFrame id="hr" title="پرونده‌ی کارمندان" activeHref="/hr/employees"><Note>دسترسی ندارید.</Note></PageFrame>;

  const renderField = ([k, label, t]: Field) => t === "sel" ? (
    <PickSelect key={k} label={label} value={f![k] ?? ""} options={OPTS[k]} onChange={(v) => (k === "status" ? setStatus(v) : set(k, v))} />
  ) : t === "chk" ? (
    <div key={k}><div className="ui-label">{label}</div>
      <div className="ui-field pk-checks">{OPTS[k].map(([v, l]) => (
        <label key={v}><input type="checkbox" checked={f![k] === v} onChange={() => set(k, f![k] === v ? "" : v)} />{l}</label>
      ))}</div></div>
  ) : t === "area" ? (
    <div key={k} style={{ gridColumn: "1 / -1" }}><div className="ui-label">{label}</div>
      <div className="ui-field"><textarea className="pk-area" autoComplete="off" value={f![k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div></div>
  ) : k === "email" ? (
    <div key={k} style={{ gridColumn: "1 / -1" }}><Input label={label} autoComplete="off" error={err.includes(label) ? err : undefined} value={f![k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div>
  ) : /Date$/.test(k) ? <div key={k}><JalaliTextDate label={label} value={f![k] ?? ""} onChange={(v) => set(k, v)} />{err.includes(label) && <div className="ui-msg" role="alert">{err}</div>}</div>
  : <Input key={k} label={label} autoComplete="off" error={err.includes(label) ? err : undefined} value={f![k] ?? ""} onChange={(e) => set(k, e.target.value)} />;

  const unitLabel = (u: Opt) => `${unitPath(u)} · ${locs.find(l => l.id === u.locationId)?.name || "محل تعیین نشده"}`;
  const unitOpts: [string, string][] = [["", "همه‌ی واحدها"], ["missing", "واحد ثبت نشده"], ...units.map((u) => [String(u.id), unitLabel(u)] as [string, string])];

  return (
    <PageFrame id="hr" title="پرونده‌ی کارمندان" activeHref="/hr/employees">
      {/* هدر صفحه */}
      <div className="emp-head">
        <div>
          <div className="emp-title">کارمندان</div>
          <div className="emp-sub">{total.toLocaleString("fa-IR")} کارمند ثبت شده در سازمان</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => setShowIO(true)}>ورود و خروج اطلاعات</Button>
          <Button variant="primary" onClick={startNew}>کارمند جدید</Button>
        </div>
      </div>

      {/* نوار جستجو و فیلتر */}
      {loadError && <Note>{loadError}</Note>}
      <div className="employee-directory"><Card>
        <div className="emp-filter-heading"><div><strong>جست‌وجو و فیلتر پرونده‌ها</strong><p>برای یافتن همکاران یا بررسی اطلاعات ناقص از فیلترها استفاده کنید.</p></div><span aria-hidden="true">⌕</span></div>
        <div className="emp-filters-grid">
          <Input label="جستجو (کد پرسنلی، نام یا کد ملی)" value={q} onChange={(e) => setQ(e.target.value)} />
          <PickSelect label="واحد سازمانی" searchable value={unitF} options={unitOpts} onChange={(v) => { setUnitF(v); setExactUnit(false); }} />
          <PickSelect label="وضعیت" value={statusF} options={[["", "همه"], ...OPTS.status]} onChange={setStatusF} />
          <PickSelect label="نوع قرارداد" value={contractF} options={[["", "همه"], ...OPTS.contractType]} onChange={setContractF} />
          <PickSelect label="محل خدمت" value={locationF} options={[["", "همه محل‌ها"], ["missing", "ثبت نشده"], ...locs.map(l => [String(l.id), l.name] as [string, string])]} onChange={setLocationF} />
          <PickSelect label="اطلاعات نیازمند تکمیل" value={issueF} options={[["", "همه پرونده‌ها"], ["all", "اطلاعات شغلی یا تاریخ استخدام ناقص"], ["unit", "بدون واحد"], ["location", "بدون محل خدمت"], ["position", "بدون عنوان شغلی"], ["birthdate", "تاریخ تولد ناقص یا نامعتبر"], ["hiredate", "تاریخ استخدام ناقص یا نامعتبر"]]} onChange={setIssueF} />
        </div>
        {activeF && <p className="emp-active-scope">فقط همکاران فعال با حساب فعال</p>}
        <div className="emp-results-heading"><div><h2>{issueF ? "پرونده‌های نیازمند تکمیل" : "فهرست کارکنان"}</h2><p>{filtersOn ? `${filtered.length.toLocaleString("fa-IR")} نفر از ${total.toLocaleString("fa-IR")} نفر` : `${total.toLocaleString("fa-IR")} نفر`}</p></div>{filtersOn && <button type="button" className="emp-reset" onClick={resetFilters}>پاک کردن فیلترها <span aria-hidden="true">×</span></button>}</div>

        <div className="emp-scroll">
          <table className="emp-table" style={{ width: "100%" }}>
            <colgroup><col style={{ width: "11%" }} /><col style={{ width: "28%" }} /><col style={{ width: "19%" }} /><col style={{ width: "17%" }} /><col style={{ width: "11%" }} /><col style={{ width: "14%" }} /></colgroup>
            <thead><tr><th>کد پرسنلی</th><th>نام</th><th>سمت</th><th>واحد</th><th>وضعیت</th><th>موبایل</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const missing = [r.unitId == null && "بدون واحد", r.locationId == null && "بدون محل خدمت", !r.positionTitle?.trim() && "بدون عنوان شغلی", !validBirthDate(r.birthDate) && "تاریخ تولد ناقص", !validBirthDate(r.hireDate) && "تاریخ استخدام ناقص"].filter((value): value is string => !!value);
                const position = [RANKS.find((x) => x.v === r.positionRank)?.label, r.positionTitle].filter(Boolean).join(" | ") || "—";
                return (
                <tr key={r.id} className={r.id === openId ? "is-sel" : ""} onClick={() => open(r.id)}>
                  <td data-label="کد پرسنلی">{r.code}</td>
                  <td data-label="نام"><button type="button" className="emp-person-name" onClick={e => { e.stopPropagation(); void open(r.id); }}>{r.firstName} {r.lastName}</button>{issueF && missing.length > 0 && <div className="emp-missing-tags" aria-label="اطلاعات نیازمند تکمیل">{missing.map(item => <span key={item}>{item}</span>)}</div>}</td>
                  <td data-label="سمت" title={position}>{position}</td>
                  <td data-label="واحد و محل خدمت"><span className="emp-unit">{unitName(r.unitId)}</span><small className="emp-location">{locs.find(l => l.id === r.locationId)?.name || "محل خدمت ثبت نشده"}</small></td>
                  <td data-label="وضعیت"><Badge tone={TONE[r.status] ?? "default"}>{STATUS[r.status] ?? r.status}</Badge></td>
                  <td data-label="موبایل"><span dir="ltr">{r.mobile ?? "—"}</span></td>
                </tr>
              ); })}
            </tbody>
          </table>
          {!list.length && !filtersOn && (
            <div className="emp-empty">
              <div>هنوز کارمندی ثبت نشده است.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                <Button variant="primary" onClick={startNew}>ثبت کارمند جدید</Button>
                <Button onClick={() => setShowIO(true)}>ورود از فایل اکسل</Button>
              </div>
            </div>
          )}
          {filtersOn && !filtered.length && (
            <div className="emp-empty">
              <div>نتیجه‌ای با این فیلترها پیدا نشد.</div>
              <div style={{ marginTop: 12 }}><Button onClick={resetFilters}>پاک کردن فیلترها</Button></div>
            </div>
          )}
        </div>

        {filtered.length > PAGE && (
          <div className="emp-pager">
            <Button disabled={page === 0} onClick={() => setPage(page - 1)}>قبلی</Button>
            <span>صفحه {(page + 1).toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}</span>
            <Button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>بعدی</Button>
          </div>
        )}
      </Card></div>

      {f && (
        <div className="emp-form" ref={formRef}><Card title={isNew ? "کارمند جدید" : `پرونده‌ی ${f.firstName} ${f.lastName} (${f.code})`} aside={<Button onClick={() => close()}>بستن</Button>}>
          <p className="emp-form-hint">{isNew ? "کد پرسنلی، نام و نام خانوادگی الزامی است." : "برای ویرایش اطلاعات از زبانه‌های زیر استفاده کنید."}{dirty && " تغییرات ذخیره نشده است."}</p>
          {err && <div className="emp-form-error" role="alert">{err}</div>}
          <div className="emp-tabs" role="tablist">
            {TABS.map((t, i) => (
              <button key={t} type="button" role="tab" aria-selected={tab === i} className={"emp-tab" + (tab === i ? " is-on" : "")} onClick={() => setTab(i)}>{t}</button>
            ))}
          </div>

          {tab === 0 && (
            <div>
              {isNew && <Input label="کد پرسنلی (رمز اولیه همین کد است)" autoComplete="off" value={f.code ?? ""} onChange={(e) => set("code", e.target.value)} />}
              <div style={grid}>{PERSONAL.map(renderField)}</div>
              <div className="emp-sec">دسترسی به پرتال</div>
              <div style={grid}>
                <div><PickSelect label="نقش در پرتال" value={f.role || "employee"} options={ROLE_OPTS} onChange={(v) => set("role", v)} />
                  <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>تعیین می‌کند این کارمند کدام بخش‌های پرتال را ببیند.</div></div>
              </div>
            </div>
          )}

          {tab === 1 && (
            <div>
              <div className="emp-sec">استخدام</div>
              <div style={grid}>{EMPLOY.map(renderField)}</div>

              <div className="emp-sec">پایان همکاری</div>
              <div className="emp-end-box">
                <label className="emp-switch">
                  <input type="checkbox" checked={endOn} onChange={(e) => toggleEnd(e.target.checked)} />
                  <span className="track" />
                  <span>پایان همکاری شده است</span>
                </label>
                <div style={{ ...grid, marginTop: 14, opacity: endOn ? 1 : 0.45, pointerEvents: endOn ? "auto" : "none" }}>
                  <JalaliTextDate label="تاریخ پایان همکاری" value={f.endDate ?? ""} onChange={(v) => set("endDate", v)} />
                  <div style={{ gridColumn: "1 / -1" }}><div className="ui-label">دلیل پایان همکاری</div>
                    <div className="ui-field"><textarea className="pk-area" autoComplete="off" disabled={!endOn} value={f.endReason ?? ""} onChange={(e) => set("endReason", e.target.value)} /></div></div>
                </div>
                {!endOn && <div style={{ fontSize: 12, opacity: .7, marginTop: 8 }}>برای ثبت پایان همکاری، کلید بالا را روشن کنید (وضعیت به «ترک کار» تغییر می‌کند).</div>}
              </div>
            </div>
          )}

          {tab === 2 && (
            <div>
              <div className="emp-sec">واحد سازمانی</div>
              <div style={grid}>
                <PickSelect label="واحد" searchable value={f.unitId ?? ""} options={units.map((u) => [String(u.id), unitLabel(u)] as [string, string])} onChange={(v) => set("unitId", v)} />
                <PickSelect label="رتبه" value={f.positionRank ?? ""} options={RANKS.map((r) => [String(r.v), r.label] as [string, string])} onChange={(v) => set("positionRank", v)} />
                <div><Input label="عنوان شغلی" autoComplete="off" placeholder="مثال: سرپرست انبار قطعات" value={f.positionTitle ?? ""} onChange={(e) => set("positionTitle", e.target.value)} />
                  <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>عنوان دلخواه شغل؛ مثلاً «رئیس مالی» یا «کارشناس ایمنی».</div></div>
                <PickSelect label="محل خدمت" value={f.locationId ?? ""} options={locs.map((u) => [String(u.id), u.name] as [string, string])} onChange={(v) => set("locationId", v)} />
              </div>
            </div>
          )}

          <div className="emp-foot">
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره"}</Button>
            <Button onClick={() => close()}>انصراف</Button>
            {err && <span style={{ color: "#B42318", fontWeight: 600 }}>{err}</span>}
            {!err && msg && <span>{msg}</span>}
          </div>
        </Card></div>
      )}

      {showIO && (
        <div className="emp-modal-bg" onClick={() => setShowIO(false)}>
          <div className="emp-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="emp-modal-head">
              <span>ورود و خروج اطلاعات کارمندان</span>
              <Button onClick={() => setShowIO(false)}>بستن</Button>
            </div>
            <ImportExport inModal onDone={load} filteredIds={filtered.map(r => r.id)} />
          </div>
        </div>
      )}
    </PageFrame>
  );
}
