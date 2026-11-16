"use client";

import { useState } from "react";
import { exportXlsx } from "@/lib/exporter";
import { ItsmPerformanceReport } from "@/components/ItsmPerformanceReport";

type Transfer={id:number;ticketId:number;title:string;source:string;destination:string;location:string|null;state:string;reason:string;createdAt:string;decidedAt:string|null};
const stateNames:Record<string,string>={pending:"در انتظار بررسی",accepted:"پذیرفته‌شده",rejected:"ردشده",cancelled:"لغوشده"};
const date=(value:string|null)=>value?new Date(value).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"}):"—";

function TransferReport() {
  const [items,setItems]=useState<Transfer[]|null>(null),[error,setError]=useState(""),[state,setState]=useState(""),[query,setQuery]=useState("");
  async function load(){try{setError("");const response=await fetch("/api/itsm/reports/transfers",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error);setItems(data);}catch(reason){setError(reason instanceof Error?reason.message:"دریافت گزارش ممکن نشد.");}}
  const rows=(items || []).filter(item=>(!state || item.state===state) && (!query.trim() || [item.ticketId,item.title,item.source,item.destination].join(" ").includes(query.trim())));
  function download(){exportXlsx("itsm-transfers-report",["شماره تیکت","عنوان","مبدأ","مقصد","محل خدمت","وضعیت","دلیل","زمان ارجاع","زمان تصمیم"],rows.map(item=>[item.ticketId,item.title,item.source,item.destination,item.location || "ثبت نشده",stateNames[item.state] || item.state,item.reason,date(item.createdAt),date(item.decidedAt)]));}
  return <section className="itsm-panel reports-builder"><details onToggle={event=>{if(event.currentTarget.open && !items && !error)void load();}}><summary>گزارش ارجاع بین واحدها</summary>{error && <p role="alert">{error}</p>}{items && <><div className="itsm-filters"><label>جست‌وجو<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="شماره، عنوان یا واحد"/></label><label>وضعیت<select value={state} onChange={event=>setState(event.target.value)}><option value="">همه وضعیت‌ها</option>{Object.entries(stateNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><p>{rows.length.toLocaleString("fa-IR")} ارجاع در محدوده دسترسی شما</p><button type="button" className="itsm-secondary" disabled={!rows.length} onClick={download}>دریافت گزارش اکسل</button><div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>تیکت</th><th>مبدأ</th><th>مقصد</th><th>وضعیت</th><th>تاریخ ارجاع</th></tr></thead><tbody>{rows.slice(0,100).map(item=><tr key={item.id}><td>{item.title} · #{item.ticketId}</td><td>{item.source}</td><td>{item.destination}</td><td>{stateNames[item.state] || item.state}</td><td>{date(item.createdAt)}</td></tr>)}</tbody></table></div>{rows.length>100 && <p>در صفحه ۱۰۰ ردیف اول نمایش داده می‌شود؛ خروجی اکسل همه نتایج فیلترشده را دارد.</p>}</>}</details></section>;
}

export function ItsmTransferReport() { return <><ItsmPerformanceReport/><TransferReport/></>; }
