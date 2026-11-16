"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, Note } from "@/components/ui";
import { useAnnouncements, isShown, type Announcement } from "@/services/lobbyNews";
import { useMe } from "@/services/useMe";
import { can } from "@/config/roles";
import { JalaliDateInput } from "@/components/JalaliDateInput";

function dateLabel(item: Announcement) {
  const date = item.createdAt ? new Date(item.createdAt) : new Date(`${item.date}T12:00:00+03:30`);
  if (Number.isNaN(date.getTime())) return "تاریخ نامشخص";
  return new Intl.DateTimeFormat("fa-IR", { timeZone:"Asia/Tehran", dateStyle:"long", ...(item.createdAt ? {timeStyle:"short" as const} : {}) }).format(date);
}
export default function AnnouncementsPage() {
  const {items,status} = useAnnouncements("archive");
  const me=useMe();
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [from,setFrom]=useState<string | undefined>();
  const [to,setTo]=useState<string | undefined>();
  const [selected,setSelected]=useState<string | null>(null);
  const clearFilters=()=>{setQuery("");setFilter("all");setFrom(undefined);setTo(undefined);};
  useEffect(()=>{const update=()=>setSelected(new URLSearchParams(window.location.search).get("id")); update(); window.addEventListener("popstate",update); return()=>window.removeEventListener("popstate",update);},[]);
  const select=(id:string|null)=>{const url=new URL(window.location.href); if(id)url.searchParams.set("id",id);else url.searchParams.delete("id"); window.history.pushState({},"",url);setSelected(id);};
  const visible=[...items].filter(item=>`${item.title} ${item.summary} ${item.body || ""}`.toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa")) && (filter==="all" || (filter==="current" ? isShown(item) : !isShown(item))) && (!from || item.date>=from) && (!to || item.date<=to)).sort((first,second)=>Number(!!second.pinned)-Number(!!first.pinned) || (second.createdAt || second.date).localeCompare(first.createdAt || first.date));
  const chosen=items.find(item=>item.id===selected);
  return <AppShell title="اطلاعیه‌ها" activeHref="/announcements"><div className="lobby-admin announcement-page"><div className="announcement-top"><div><h1>اطلاعیه‌های سازمان</h1><p>خبرها و اطلاعیه‌های روابط عمومی و آرشیو اطلاعیه‌های پیشین</p></div>{me && can(me.role,"lobby.manage") && <Link href="/announcements/manage">مدیریت اطلاعیه‌ها ←</Link>}</div><div className="lobby-admin-section">
    {selected ? <Card title={chosen?.title || "جزئیات اطلاعیه"}><button className="announcement-back" onClick={()=>select(null)}>← بازگشت به اطلاعیه‌ها</button>{status==="loading" ? <p>در حال دریافت اطلاعیه...</p> : status==="error" ? <Note>دریافت اطلاعات ممکن نشد.</Note> : !chosen ? <Note>اطلاعیه پیدا نشد یا برای شما قابل نمایش نیست.</Note> : <article className="announcement-detail"><small>اطلاعیه روابط عمومی · {dateLabel(chosen)}</small>{chosen.poster && <img src={chosen.poster} alt="" />}<p className="announcement-summary">{chosen.summary}</p>{chosen.body && <p>{chosen.body}</p>}</article>}</Card> : <Card title="فهرست اطلاعیه‌ها"><div className="lobby-news-filters"><label>جست‌وجو<input placeholder="عنوان یا متن اطلاعیه" value={query} onChange={e=>setQuery(e.target.value)} /></label><label>وضعیت<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">همه اطلاعیه‌ها</option><option value="current">جاری</option><option value="archive">پایان‌یافته</option></select></label><div>از تاریخ<JalaliDateInput label="از تاریخ" value={from} onChange={setFrom} /></div><div>تا تاریخ<JalaliDateInput label="تا تاریخ" value={to} onChange={setTo} /></div></div>{from && to && from>to && <Note>تاریخ شروع بعد از تاریخ پایان است.</Note>}{status==="loading" ? <p>در حال دریافت اطلاعیه‌ها...</p> : status==="error" ? <Note>دریافت اطلاعیه‌ها ممکن نشد.</Note> : <><div className="announcement-filter-actions"><p>{visible.length.toLocaleString("fa-IR")} اطلاعیه</p><button className="announcement-clear" onClick={clearFilters}>پاک‌کردن فیلترها</button></div><div className="announcement-list">{visible.map(item=><article key={item.id}><div className="announcement-list-content">{item.poster && <img className="announcement-thumb" src={item.poster} alt="" />}<div><div className="announcement-list-heading"><strong>{item.title}</strong>{item.pinned && <span className="announcement-important">مهم</span>}</div><p>{item.summary}</p><small>{dateLabel(item)} · {isShown(item) ? "جاری" : "پایان‌یافته"}</small></div></div><button className="announcement-back" onClick={()=>select(item.id)}>مشاهده اطلاعیه ←</button></article>)}</div>{!visible.length && <Note>اطلاعیه‌ای با این شرایط پیدا نشد.</Note>}</>}</Card>}
  </div></div></AppShell>;
}
