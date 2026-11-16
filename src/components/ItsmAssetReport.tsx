"use client";

import { useMemo, useState } from "react";
import { exportXlsx } from "@/lib/exporter";

type Asset = { id:number; name:string; code:string; category:string; warehouse:string; location:string; status:string; firstName:string|null; lastName:string|null; serial:string; brand:string; model:string; transferPending:boolean };
const labels:Record<string,string> = { available:"موجود در انبار", assigned:"تحویل‌شده", broken:"خراب", repair:"در حال تعمیر", quarantine:"قرنطینه", scrapped:"اسقاط‌شده" };
const normalize = (value:string) => value.toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").trim();

export function ItsmAssetReport({ assets }: { assets:Asset[] }) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("");
  const [location,setLocation]=useState("");
  const [warehouse,setWarehouse]=useState("");
  const locations=useMemo(()=>Array.from(new Set(assets.map(asset=>asset.location))).sort(),[assets]);
  const warehouses=useMemo(()=>Array.from(new Set(assets.filter(asset=>!location || asset.location===location).map(asset=>asset.warehouse))).sort(),[assets,location]);
  const filtered=useMemo(()=>assets.filter(asset=>{
    const search=normalize([asset.name,asset.code,asset.serial,asset.brand,asset.model,asset.firstName || "",asset.lastName || ""].join(" "));
    return (!query.trim() || search.includes(normalize(query))) && (!status || asset.status===status) && (!location || asset.location===location) && (!warehouse || asset.warehouse===warehouse);
  }),[assets,query,status,location,warehouse]);
  function download(){
    const columns=["کد دارایی","نام","دسته‌بندی","وضعیت","محل خدمت","انبار","تحویل‌گیرنده","برند","مدل","شماره سریال","در انتظار انتقال"];
    const rows=filtered.map(asset=>[asset.code,asset.name,asset.category,labels[asset.status] || asset.status,asset.location,asset.warehouse,[asset.firstName,asset.lastName].filter(Boolean).join(" "),asset.brand,asset.model,asset.serial,asset.transferPending ? "بله" : "خیر"]);
    exportXlsx("itsm-assets-report",columns,rows);
  }
  return <section className="itsm-panel itsm-asset-report"><details><summary>گزارش دارایی‌ها و خروجی اکسل</summary><p>گزارش بر اساس دارایی‌های قابل مشاهده برای حساب شما تهیه می‌شود.</p><div className="itsm-filters"><label>جست‌وجو<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="نام، کد، سریال یا تحویل‌گیرنده"/></label><label>وضعیت<select value={status} onChange={event=>setStatus(event.target.value)}><option value="">همه وضعیت‌ها</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>محل خدمت<select value={location} onChange={event=>{setLocation(event.target.value);setWarehouse("");}}><option value="">همه محل‌ها</option>{locations.map(value=><option key={value}>{value}</option>)}</select></label><label>انبار<select value={warehouse} onChange={event=>setWarehouse(event.target.value)}><option value="">همه انبارها</option>{warehouses.map(value=><option key={value}>{value}</option>)}</select></label></div><p>{filtered.length.toLocaleString("fa-IR")} دارایی مطابق فیلترها</p><button type="button" className="itsm-secondary" disabled={!filtered.length} onClick={download}>دریافت گزارش اکسل</button></details></section>;
}
