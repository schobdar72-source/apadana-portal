"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ItsmReportLink(){
 const [unread,setUnread]=useState(0);
 useEffect(()=>{let live=true;async function refresh(){try{const r=await fetch('/api/itsm/reports/schedules',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(live)setUnread(data.unreadCount);}catch{/* در صورت قطع ارتباط، اعلان در به‌روزرسانی بعدی بررسی می‌شود. */}}void refresh();const timer=setInterval(refresh,60000);return()=>{live=false;clearInterval(timer);};},[]);
 return <Link className="itsm-asset-nav" href="/tickets/reports">گزارش و داشبورد {unread>0 && <span aria-label={`${unread} گزارش خوانده‌نشده`}>· {unread.toLocaleString('fa-IR')} جدید</span>}</Link>;
}
