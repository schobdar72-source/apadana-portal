"use client";
import { useState } from "react";
type Row={groupName:string;assigneeId:number|null;assignee:string;total:number;closed:number;rated:number;average:number|null};
export function ItsmPerformanceReport(){
  const [rows,setRows]=useState<Row[]|null>(null),[error,setError]=useState("");
  async function load(){try{const response=await fetch("/api/itsm/reports/performance",{cache:"no-store"});const body=await response.json();if(!response.ok)throw Error(body.error);setRows(body);}catch(reason){setError(reason instanceof Error?reason.message:"دریافت گزارش ممکن نشد.");}}
  return <section className="itsm-panel reports-builder"><details onToggle={event=>{if(event.currentTarget.open && !rows && !error)void load();}}><summary>عملکرد کارشناسان و رضایت کاربران</summary><p>آمار همه زمان‌ها، بر اساس واحد و کارشناس فعلی تیکت محاسبه می‌شود.</p>{error&&<p role="alert">{error}</p>}{rows&&(!rows.length?<p>اطلاعاتی برای نمایش وجود ندارد.</p>:<div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>واحد</th><th>کارشناس</th><th>تعداد تیکت</th><th>حل یا بسته‌شده</th><th>تعداد نظرات</th><th>میانگین رضایت از ۵</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.groupName}-${row.assigneeId}`}><td>{row.groupName}</td><td>{row.assignee || "تخصیص نیافته"}</td><td>{row.total.toLocaleString("fa-IR")}</td><td>{row.closed.toLocaleString("fa-IR")}</td><td>{row.rated.toLocaleString("fa-IR")}</td><td>{row.average===null?"—":row.average.toLocaleString("fa-IR",{maximumFractionDigits:1})}</td></tr>)}</tbody></table></div>)}</details></section>;
}
