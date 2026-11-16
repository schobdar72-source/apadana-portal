"use client";
import { useMemo, useState } from "react";
import { PageFrame } from "@/components/PageFrame";
import { Button, Card, DataTable, Kpi, Note } from "@/components/ui";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { exportCsv, exportXlsx } from "@/lib/exporter";
import { useEmployees, useOrders, useCredit, limitOf, groupOf } from "@/services/cafeData";
import { toJalali, toGregorian } from "@/lib/jalali";
import { useFinanceReports } from "@/services/financeData";
import "@/styles/cafe.css";

const fa = (n: number) => n.toLocaleString("fa-IR");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const stamp = (s: string, end = false) => new Date(s + (end ? "T23:59:59.999" : "T00:00:00")).getTime();
const monthKey = (t: number) => { const d = new Date(t), j = toJalali(d.getFullYear(), d.getMonth()+1, d.getDate()); return `${j.jy}-${j.jm}`; };
const jdate = (s: string) => { const [y,m,d] = s.split("-").map(Number), j = toJalali(y,m,d); return `${j.jy.toLocaleString("fa-IR",{useGrouping:false})}/${fa(j.jm)}/${fa(j.jd)}`; };
const periods = [{k:"day",t:"امروز"},{k:"week",t:"۷ روز اخیر"},{k:"month",t:"ماه جاری"},{k:"quarter",t:"فصل جاری"},{k:"year",t:"سال جاری"},{k:"custom",t:"بازه دلخواه"}];
function getRange(k: string) {
  const now = new Date(), j = toJalali(now.getFullYear(),now.getMonth()+1,now.getDate());
  if (k === "day" || k === "week") { const d = new Date(now); d.setDate(d.getDate()-(k === "week" ? 6 : 0)); return {from:iso(d),to:iso(now)}; }
  const m = k === "year" ? 1 : k === "quarter" ? Math.floor((j.jm-1)/3)*3+1 : j.jm;
  const g = toGregorian(j.jy,m,1);
  return {from:`${g.gy}-${String(g.gm).padStart(2,"0")}-${String(g.gd).padStart(2,"0")}`,to:iso(now)};
}
const initial = () => ({r:getRange("month"),unit:"",grp:"",bal:"",search:""});
const normalize = (s: string) => s.replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).toLowerCase().trim();

export default function Page() {
  const {orders,ready:ordersReady,error:ordersError} = useOrders();
  const {employees,ready:employeesReady,error:employeesError} = useEmployees();
  const {credit,ready:creditReady,error:creditError} = useCredit();
  const fin = useFinanceReports();
  const [period,setPeriod] = useState("month"), [draft,setDraft] = useState(initial), [applied,setApplied] = useState(initial);
  const [sort,setSort] = useState("name"), [message,setMessage] = useState(""), [confirm,setConfirm] = useState(false), [sending,setSending] = useState(false);
  const error = ordersError || employeesError || creditError;
  const ready = ordersReady && employeesReady && creditReady;
  const invalid = !draft.r.from || !draft.r.to || draft.r.from > draft.r.to;
  const data = useMemo(() => {
    const a = stamp(applied.r.from), b = stamp(applied.r.to,true);
    const active = orders.filter(o=>!o.cancelled && o.ts && o.ts <= b);
    const months = new Set<string>();
    for (let d = new Date(applied.r.from+"T12:00:00"), end = new Date(applied.r.to+"T12:00:00"); d <= end; d.setDate(d.getDate()+1)) months.add(monthKey(d.getTime()));
    const matching = employees.filter(e => (!applied.unit || e.unit===applied.unit) && (!applied.grp || groupOf(credit,e.code)?.id===applied.grp) && (!applied.search || normalize(`${e.name} ${e.code}`).includes(normalize(applied.search))));
    const rows = matching.filter(e=>Number.isFinite(limitOf(credit,e.code))).map(e=>{
      const lim = limitOf(credit,e.code), mine = active.filter(o=>o.code===e.code && !o.guest && o.ts && months.has(monthKey(o.ts)));
      const monthTotals = new Map<string,{before:number;inside:number}>();
      for (const o of mine) { const key=monthKey(o.ts!), v=monthTotals.get(key) || {before:0,inside:0}; if (o.ts! < a) v.before+=o.total; else v.inside+=o.total; monthTotals.set(key,v); }
      const used = [...monthTotals.values()].reduce((s,v)=>s+v.inside,0);
      const excess = [...monthTotals.values()].reduce((s,v)=>s+Math.max(0,v.before+v.inside-lim)-Math.max(0,v.before-lim),0);
      const pkg=lim*months.size, left=pkg-used;
      return {...e,grp:groupOf(credit,e.code)?.name || "—",pkg,used,left,excess};
    }).filter(x=>!applied.bal || (applied.bal==="neg" ? x.excess>0 : x.left>0));
    rows.sort((a,b)=>sort==="used" ? b.used-a.used : sort==="excess" ? b.excess-a.excess : a.name.localeCompare(b.name,"fa"));
    const selected = new Set(rows.map(x=>x.code));
    const unlimited = new Set(matching.filter(e=>!Number.isFinite(limitOf(credit,e.code))).map(e=>e.code));
    const within = active.filter(o=>o.ts!>=a && o.ts!<=b);
    const employeeOrders=within.filter(o=>!o.guest && o.code && selected.has(o.code));
    const unlimitedOrders=applied.bal ? [] : within.filter(o=>!o.guest && o.code && unlimited.has(o.code));
    // Guest orders are only included when no employee-specific filter is selected.
    const unfiltered=!(applied.unit || applied.grp || applied.bal || applied.search);
    const guests=unfiltered ? within.filter(o=>o.guest) : [];
    const known = new Set(employees.map(e=>e.code));
    const unmatched=unfiltered ? within.filter(o=>!o.guest && (!o.code || !known.has(o.code))) : [];
    const total=(list: typeof within)=>list.reduce((s,o)=>s+o.total,0);
    return {rows,employeeSales:total(employeeOrders),unlimitedSales:total(unlimitedOrders),guestSales:total(guests),unmatchedSales:total(unmatched),count:employeeOrders.length+unlimitedOrders.length+guests.length+unmatched.length, excess:rows.reduce((s,x)=>s+x.excess,0),debtors:rows.filter(x=>x.excess>0).length};
  },[orders,employees,credit,applied,sort]);
  const sales=data.employeeSales+data.unlimitedSales+data.guestSales+data.unmatchedSales;
  const label=`${jdate(applied.r.from)} تا ${jdate(applied.r.to)}`;
  const table=()=>({head:["کد پرسنلی","نام","گروه","واحد","سقف ماه‌های بازه (تومان)","مصرف دوره (تومان)","مانده نمایشی (تومان)","مازاد دوره (تومان)"],rows:data.rows.map(x=>[x.code,x.name,x.grp,x.unit,x.pkg,x.used,x.left,x.excess]),name:`cafe-report-${applied.r.from}_${applied.r.to}`});
  const send=async()=>{ setSending(true); setMessage(""); try { const id=`${applied.r.from}_${applied.r.to}`, report={id,period:label,from:applied.r.from,to:applied.r.to,sender:"مدیر کافی‌شاپ",ts:Date.now(),sales,count:data.count,scope:{unit:applied.unit,group:credit.groups.find(g=>g.id===applied.grp)?.name || "",balance:applied.bal==="neg"?"دارای مازاد دوره":applied.bal==="pos"?"مانده نمایشی مثبت":"",search:applied.search},breakdown:{employee:data.employeeSales,unlimited:data.unlimitedSales,guest:data.guestSales,unmatched:data.unmatchedSales},rows:data.rows.map(({code,name,grp,unit,pkg,used,left,excess})=>({code,name,grp,unit,pkg,used,left,excess}))}; const ok=await fin.save([...fin.list.filter(x=>x.id!==id),report]); setMessage(ok?"گزارش برای واحد مالی ثبت شد.":"ثبت گزارش ناموفق بود."); } catch {setMessage("ثبت گزارش ناموفق بود.");} finally {setSending(false);setConfirm(false);} };
  const disabled=!ready || !!error;
  return <PageFrame id="cafe" title="گزارش‌های کافی‌شاپ" activeHref="/cafe/reports">
    <div className="crumb crumb-dark">صفحه اصلی / کافی‌شاپ / گزارش‌ها</div><h2 className="cafe-h">گزارش‌های کافی‌شاپ</h2>
    <div className="cafe-orders rep-page report-refresh">
      <Card title="دوره و فیلتر گزارش">
        <div className="rep-periods">{periods.map(p=><button key={p.k} type="button" className={period===p.k?"on":""} onClick={()=>{setPeriod(p.k); if(p.k!=="custom")setDraft({...draft,r:getRange(p.k)});}}>{p.t}</button>)}</div>
        <div className="rep-filters">
          <div className="rep-f"><span>از تاریخ</span><JalaliDateInput label="از تاریخ" value={draft.r.from} onChange={v=>{setPeriod("custom");setDraft({...draft,r:{...draft.r,from:v || ""}});}} /></div>
          <div className="rep-f"><span>تا تاریخ</span><JalaliDateInput label="تا تاریخ" value={draft.r.to} onChange={v=>{setPeriod("custom");setDraft({...draft,r:{...draft.r,to:v || ""}});}} /></div>
          <label className="rep-f"><span>واحد</span><select value={draft.unit} onChange={e=>setDraft({...draft,unit:e.target.value})}><option value="">همه واحدها</option>{Array.from(new Set(employees.map(e=>e.unit).filter(Boolean))).map(u=><option key={u}>{u}</option>)}</select></label>
          <label className="rep-f"><span>گروه اعتبار</span><select value={draft.grp} onChange={e=>setDraft({...draft,grp:e.target.value})}><option value="">همه گروه‌ها</option>{credit.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="rep-f"><span>وضعیت اعتبار</span><select value={draft.bal} onChange={e=>setDraft({...draft,bal:e.target.value})}><option value="">همه</option><option value="neg">دارای مازاد دوره</option><option value="pos">مانده نمایشی مثبت</option></select></label>
          <label className="rep-f"><span>جست‌وجوی کارمند</span><input value={draft.search} onChange={e=>setDraft({...draft,search:e.target.value})} placeholder="نام، نام خانوادگی یا کد پرسنلی" /></label>
        </div>
        {invalid && <p className="rep-warning" role="alert">تاریخ شروع و پایان را درست انتخاب کنید؛ شروع نباید بعد از پایان باشد.</p>}
        <div className="rep-actions"><Button variant="primary" disabled={invalid||disabled} onClick={()=>{setApplied(draft);setMessage("");}}>نمایش گزارش</Button><Button onClick={()=>{const x=initial();setDraft(x);setApplied(x);setPeriod("month");}}>پاک‌کردن فیلترها</Button></div>
      </Card>
      {!ready ? <Note>در حال دریافت اطلاعات گزارش...</Note> : error ? <Note>{error} لطفاً صفحه را دوباره بارگذاری کنید.</Note> : <>
        <Card title="خلاصه دوره"><p className="rep-caption">بازه اعمال‌شده: {label} · {fa(data.rows.length)} کارمند با اعتبار محدود</p><div className="rep-kpis"><Kpi label="تعداد سفارش‌های گزارش" value={fa(data.count)} /><Kpi label="جمع فروش گزارش" value={fa(sales)+" تومان"} /><Kpi label="افراد دارای مازاد دوره" value={fa(data.debtors)+" نفر"} /><Kpi label="جمع مازاد دوره" value={fa(data.excess)+" تومان"} /></div><div className="rep-breakdown"><span>کارکنان با اعتبار محدود: {fa(data.employeeSales)} تومان</span><span>اعتبار نامحدود: {fa(data.unlimitedSales)} تومان</span><span>مهمان: {fa(data.guestSales)} تومان</span><span>بدون کارمند شناسایی‌شده: {fa(data.unmatchedSales)} تومان</span></div><p className="rep-caption">سفارش مهمان و بدون کارمند شناسایی‌شده فقط در گزارش بدون فیلتر کارکنان نمایش داده می‌شود. سفارش لغوشده محاسبه نمی‌شود.</p></Card>
        <Card title="جزئیات کارکنان با اعتبار محدود"><div className="rep-toolbar"><span>{fa(data.rows.length)} نفر · {label}</span><label>مرتب‌سازی <select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">نام</option><option value="used">بیشترین مصرف</option><option value="excess">بیشترین مازاد</option></select></label></div>
          {!data.rows.length ? <Note>برای فیلترهای انتخاب‌شده کارمندی یافت نشد.</Note> : <DataTable columns={["کد پرسنلی","نام","گروه","واحد","سقف ماه‌ها (تومان)","مصرف دوره (تومان)","مانده نمایشی (تومان)","مازاد دوره (تومان)"]} rows={[...data.rows.map(x=>[x.code,x.name,x.grp,x.unit,fa(x.pkg),fa(x.used),<span key="left">{fa(x.left)}</span>,<span key="excess" className={x.excess>0?"rep-excess":""}>{fa(x.excess)}{x.excess>0?" · بالای سقف":""}</span>]),["جمع",`${fa(data.rows.length)} نفر`,"","",fa(data.rows.reduce((s,x)=>s+x.pkg,0)),fa(data.rows.reduce((s,x)=>s+x.used,0)),fa(data.rows.reduce((s,x)=>s+x.left,0)),fa(data.excess)]]} />}
          <Note>مازاد هر ماه جداگانه و با درنظرگرفتن مصرف پیش از شروع بازه در همان ماه محاسبه می‌شود. سقف و مانده نمایشی بر اساس تنظیمات فعلی و مجموع سقف ماه‌های درگیر است؛ برای بازه ناقص، مانده قابل برداشت نیست. سوابق تغییر سقف نگهداری نمی‌شود. تصمیم کسر از حقوق با واحد مالی است.</Note>
          <div className="rep-actions"><Button disabled={!data.rows.length} onClick={()=>{const t=table();exportCsv(t.name,t.head,t.rows);}}>خروجی CSV</Button><Button disabled={!data.rows.length} onClick={()=>{const t=table();exportXlsx(t.name,t.head,t.rows);}}>خروجی Excel</Button><Button onClick={()=>window.print()}>چاپ / ذخیره PDF</Button><Button disabled={!fin.ready || !!fin.error || !data.rows.length} onClick={()=>setConfirm(true)}>ارسال به مالی</Button></div>
          {fin.error && <p className="rep-warning" role="alert">{fin.error} برای جلوگیری از جایگزینی ناخواسته، ارسال غیرفعال است.</p>}
          {message && <p role="status">{message}</p>}
          {confirm && <div className="rep-confirm" role="group" aria-label="تأیید ارسال گزارش"><p>گزارش {label} شامل {fa(data.rows.length)} کارمند و جمع فروش {fa(sales)} تومان ارسال شود؟ {fin.list.some(x=>x.id===`${applied.r.from}_${applied.r.to}`) && "گزارش قبلی همین بازه جایگزین می‌شود."}</p><Button variant="primary" disabled={sending} onClick={send}>{sending?"در حال ارسال...":"تأیید ارسال"}</Button> <Button disabled={sending} onClick={()=>setConfirm(false)}>انصراف</Button></div>}
        </Card>
      </>}
    </div>
  </PageFrame>;
}
