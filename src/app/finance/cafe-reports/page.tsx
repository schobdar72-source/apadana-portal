"use client";
import { useMemo, useState } from "react";
import { PageFrame } from "@/components/PageFrame";
import { Button, Card, DataTable, Kpi, Note } from "@/components/ui";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { useFinanceReports, type FinReport, type FinRow } from "@/services/financeData";
import { exportCsv, exportXlsx } from "@/lib/exporter";
import { toJalali } from "@/lib/jalali";
import "@/styles/cafe.css";

const fa = (n: number) => n.toLocaleString("fa-IR");
const fy = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
const norm = (s: string) => s.replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).toLowerCase().trim();
const jd = (s: string) => { const [y,m,d]=s.split("-").map(Number), j=toJalali(y,m,d); return `${fy(j.jy)}/${fy(j.jm).padStart(2,"۰")}/${fy(j.jd).padStart(2,"۰")}`; };
const dt = (ts: number) => { const d=new Date(ts); return `${jd(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`)} ${fy(d.getHours()).padStart(2,"۰")}:${fy(d.getMinutes()).padStart(2,"۰")}`; };
const scopeText = (r: FinReport) => !r.scope ? "محدوده گزارش قدیمی مشخص نیست" : [r.scope.unit && `واحد: ${r.scope.unit}`, r.scope.group && `گروه: ${r.scope.group}`, r.scope.balance && `وضعیت: ${r.scope.balance}`, r.scope.search && `جست‌وجو: ${r.scope.search}`].filter(Boolean).join(" · ") || "بدون فیلتر کارکنان";
const head = ["کد پرسنلی","نام","گروه","واحد","سقف ماه‌های بازه (تومان)","مصرف دوره (تومان)","مانده نمایشی (تومان)","مازاد دوره (تومان)"];

export default function Page() {
  const {list,ready,error} = useFinanceReports();
  const [selected,setSelected]=useState<string|null>(null);
  const [periodQuery,setPeriodQuery]=useState(""), [from,setFrom]=useState(""), [to,setTo]=useState("");
  const [query,setQuery]=useState(""), [unit,setUnit]=useState(""), [sort,setSort]=useState("name");
  const sorted=useMemo(()=>[...list].sort((a,b)=>b.ts-a.ts),[list]);
  const reports=sorted.filter(r=>(!periodQuery || norm(`${r.period} ${r.sender} ${jd(r.from)} ${jd(r.to)}`).includes(norm(periodQuery))) && (!from || r.to>=from) && (!to || r.from<=to));
  const cur=sorted.find(r=>r.id===selected) || null;
  const view=useMemo(()=>{
    if(!cur)return null;
    const rows=cur.rows.filter(r=>(!query || norm(`${r.name} ${r.code} ${r.unit}`).includes(norm(query))) && (!unit || r.unit===unit));
    rows.sort((a,b)=>sort==="used"?b.used-a.used:sort==="excess"?b.excess-a.excess:sort==="left"?a.left-b.left:a.name.localeCompare(b.name,"fa"));
    return {rows,excess:cur.rows.reduce((s,r)=>s+r.excess,0),debtors:cur.rows.filter(r=>r.excess>0).length,
      used:rows.reduce((s,r)=>s+r.used,0),left:rows.reduce((s,r)=>s+r.left,0),shownExcess:rows.reduce((s,r)=>s+r.excess,0)};
  },[cur,query,unit,sort]);
  const download=(kind:"csv"|"xlsx",rows:FinRow[],scope:"filtered"|"all")=>{
    if(!cur)return;
    const data=rows.map(r=>[r.code,r.name,r.grp,r.unit,r.pkg,r.used,r.left,r.excess]);
    const name=`cafe-finance-${cur.from}_${cur.to}-${scope}`;
    if(kind==="csv")exportCsv(name,head,data);else exportXlsx(name,head,data);
  };
  return <PageFrame id="cafe" title="گزارش‌های کافی‌شاپ" activeHref="/finance/cafe-reports">
    <style>{`@media print{body *{visibility:hidden!important}.fin-report,.fin-report *{visibility:visible!important}.fin-report{position:absolute;top:0;left:0;width:100%;background:#fff!important;color:#000!important}.fin-noprint{display:none!important}.fin-report .ui-card,.fin-report .ui-table th,.fin-report .ui-table tr{background:#fff!important;color:#000!important;box-shadow:none!important}}`}</style>
    <div className="crumb crumb-dark">صفحه اصلی / مالی / گزارش‌های کافی‌شاپ</div><h2 className="cafe-h">گزارش‌های دریافتی از کافی‌شاپ</h2>
    <div className="cafe-orders report-refresh finance-page">
      <Card title="گزارش‌های دریافتی">
        {!ready?<Note>در حال دریافت گزارش‌ها...</Note>:error?<div role="alert" className="rep-warning">{error} لطفاً صفحه را دوباره بارگذاری کنید.</div>:<>
          <p className="rep-caption">{fa(sorted.length)} گزارش دریافتی · {sorted.length ? `آخرین ارسال: ${dt(sorted[0].ts)}` : "هنوز گزارشی دریافت نشده است."}</p>
          <div className="finance-filters fin-noprint">
            <label className="rep-f"><span>جست‌وجوی دوره یا فرستنده</span><input value={periodQuery} onChange={e=>setPeriodQuery(e.target.value)} placeholder="دوره، تاریخ یا فرستنده" /></label>
            <div className="rep-f"><span>از تاریخ</span><JalaliDateInput label="از تاریخ گزارش" value={from} onChange={v=>setFrom(v||"")} /></div>
            <div className="rep-f"><span>تا تاریخ</span><JalaliDateInput label="تا تاریخ گزارش" value={to} onChange={v=>setTo(v||"")} /></div>
            <Button onClick={()=>{setPeriodQuery("");setFrom("");setTo("");}}>پاک‌کردن فیلترها</Button>
          </div>
          {from && to && from>to?<p className="rep-warning" role="alert">تاریخ شروع نباید پس از تاریخ پایان باشد.</p>:!reports.length?<Note>گزارشی برای این فیلترها یافت نشد.</Note>:<>
            <p className="rep-caption">{fa(reports.length)} گزارش نمایش داده می‌شود. برای مشاهده، دکمه جزئیات را انتخاب کنید.</p>
            <div className="finance-table-wrap"><DataTable columns={["دوره","بازه","ارسال‌کننده","زمان ارسال","سفارش","فروش (تومان)","کارمندان",""]}
              rows={reports.map(r=>[r.period,`${jd(r.from)} تا ${jd(r.to)}`,r.sender,dt(r.ts),fa(r.count),fa(r.sales),fa(r.rows.length),<Button key={r.id} size="sm" onClick={()=>{setSelected(r.id);setQuery("");setUnit("");}} aria-label={`جزئیات گزارش ${r.period}`}>{r.id===selected?"انتخاب‌شده":"جزئیات"}</Button>])} activeRow={reports.findIndex(r=>r.id===selected)} /></div>
          </>}
        </>}
      </Card>
      {cur && view && <div className="fin-report"><Card title={`جزئیات گزارش ${cur.period}`}>
        <div className="fin-print-head">آپادانا کاوش ایرانیان — گزارش کافی‌شاپ · چاپ‌شده در {dt(Date.now())}</div>
        <p className="rep-caption">بازه: {jd(cur.from)} تا {jd(cur.to)} · فرستنده: {cur.sender} · زمان ارسال: {dt(cur.ts)}</p>
        <div className="finance-scope"><strong>محدوده گزارش:</strong> {scopeText(cur)}</div>
        <div className="rep-kpis"><Kpi label="جمع مازاد دوره" value={fa(view.excess)+" تومان"} /><Kpi label="کارمندان دارای مازاد" value={fa(view.debtors)+" نفر"} /><Kpi label="فروش گزارش" value={fa(cur.sales)+" تومان"} /><Kpi label="تعداد سفارش" value={fa(cur.count)} /></div>
        {cur.breakdown?<div className="rep-breakdown"><span>اعتبار محدود: {fa(cur.breakdown.employee)} تومان</span><span>اعتبار نامحدود: {fa(cur.breakdown.unlimited)} تومان</span><span>مهمان: {fa(cur.breakdown.guest)} تومان</span><span>بدون کارمند شناسایی‌شده: {fa(cur.breakdown.unmatched)} تومان</span></div>:<Note>تفکیک فروش برای این گزارش قدیمی ثبت نشده است.</Note>}
        <div className="finance-detail-filters fin-noprint">
          <label className="rep-f"><span>جست‌وجوی کارمند</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام، نام خانوادگی یا کد پرسنلی" /></label>
          <label className="rep-f"><span>واحد</span><select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">همه واحدها</option>{Array.from(new Set(cur.rows.map(r=>r.unit).filter(Boolean))).map(u=><option key={u}>{u}</option>)}</select></label>
          <label className="rep-f"><span>مرتب‌سازی</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">نام</option><option value="used">بیشترین مصرف</option><option value="excess">بیشترین مازاد</option><option value="left">کمترین مانده</option></select></label>
        </div>
        <p className="rep-caption">نتایج نمایش‌داده‌شده: {fa(view.rows.length)} نفر از {fa(cur.rows.length)} نفر{query ? ` · جست‌وجو: ${query}` : ""}{unit ? ` · واحد: ${unit}` : ""}</p>
        {!view.rows.length?<Note>کارمندی برای این فیلترها یافت نشد.</Note>:<div className="finance-table-wrap"><DataTable columns={head} rows={[...view.rows.map(r=>[r.code,r.name,r.grp,r.unit,fa(r.pkg),fa(r.used),fa(r.left),<span key="e" className={r.excess>0?"rep-excess":""}>{fa(r.excess)}{r.excess>0?" · مازاد":""}</span>]),["جمع",`${fa(view.rows.length)} نفر`,"","",fa(view.rows.reduce((s,r)=>s+r.pkg,0)),fa(view.used),fa(view.left),fa(view.shownExcess)]]} /></div>}
        <Note>مازاد فقط برای بررسی مالی گزارش می‌شود و به معنی کسر خودکار از حقوق نیست. مانده گزارش‌های جدید نمایشی است و لزوماً اعتبار قابل برداشت نیست.</Note>
        <div className="rep-actions fin-noprint"><Button disabled={!view.rows.length} onClick={()=>download("xlsx",view.rows,"filtered")}>اکسل نتایج نمایش‌داده‌شده</Button><Button onClick={()=>download("xlsx",cur.rows,"all")}>اکسل کل گزارش</Button><Button disabled={!view.rows.length} onClick={()=>download("csv",view.rows,"filtered")}>CSV نتایج نمایش‌داده‌شده</Button><Button onClick={()=>download("csv",cur.rows,"all")}>CSV کل گزارش</Button><Button onClick={()=>window.print()}>چاپ / ذخیره PDF</Button></div>
      </Card></div>}
    </div>
  </PageFrame>;
}
