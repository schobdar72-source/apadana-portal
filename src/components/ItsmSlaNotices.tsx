"use client";
import { useCallback,useEffect,useState } from 'react';
type Notice={id:number;ticketId:number;title:string;metric:string;kind:string;readAt:string|null;createdAt:string};
export function ItsmSlaNotices({onOpen}:{onOpen:(id:number)=>Promise<void>}){
 const [items,setItems]=useState<Notice[]>([]),[open,setOpen]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/itsm/sla/notices',{cache:'no-store'});if(!r.ok)throw Error('دریافت اعلان‌ها ممکن نشد.');setItems(await r.json())},[]);
 useEffect(()=>{let live=true;const refresh=()=>{void load().catch(()=>{if(live)setError('دریافت اعلان‌ها ممکن نشد.')})};refresh();const timer=setInterval(refresh,60000);return()=>{live=false;clearInterval(timer)}},[load]);
 async function select(item:Notice){try{const r=await fetch('/api/itsm/sla/notices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})});if(!r.ok)throw Error('اعلان دیگر در دسترس نیست.');await onOpen(item.ticketId);await load();setOpen(false);setError('')}catch(e){setError(e instanceof Error?e.message:'خطا در نمایش اعلان.')}}
 const unread=items.filter(x=>!x.readAt).length;
 return <div className="itsm-notices"><button type="button" className="itsm-asset-nav" onClick={()=>setOpen(!open)} aria-expanded={open}>اعلان‌های زمان رسیدگی {unread>0&&<span className="itsm-nav-count">{unread.toLocaleString('fa-IR')}</span>}</button>{open&&<div className="itsm-notice-list">{error&&<p role="status">{error}</p>}{items.length===0?<p>اعلانی وجود ندارد.</p>:items.map(item=><button type="button" key={item.id} className={item.readAt?'':'unread'} onClick={()=>void select(item)}>{item.kind==='warning'?'نزدیک موعد':'عبور از موعد'} {item.metric==='response'?'پاسخ اولیه':'حل'}<small>#{item.ticketId} · {item.title}</small></button>)}</div>}</div>;
}
