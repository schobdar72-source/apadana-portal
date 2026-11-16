"use client";
import { useEffect, useState } from "react";
import { itsmNotify } from "@/components/ItsmFeedback";

type Rating = { visible:boolean; canRate?:boolean; score?:number|null; note?:string };
export function ItsmSatisfaction({ ticketId }: { ticketId:number }) {
  const [rating,setRating]=useState<Rating|null>(null), [score,setScore]=useState(0), [note,setNote]=useState(""), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  useEffect(()=>{const controller=new AbortController(); fetch(`/api/itsm/tickets/${ticketId}/satisfaction`,{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw Error("دریافت نظرسنجی ممکن نشد.");setRating(await response.json());}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});return()=>controller.abort();},[ticketId]);
  async function submit(){if(!score)return;setBusy(true);setError("");try{const response=await fetch(`/api/itsm/tickets/${ticketId}/satisfaction`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({score,note})});const result=await response.json();if(!response.ok)throw Error(result.error);setRating({visible:true,score,note});itsmNotify("نظر شما ثبت شد؛ سپاس از بازخوردتان.");}catch(reason){setError(reason instanceof Error?reason.message:"ثبت نظر ممکن نشد.");}finally{setBusy(false);}}
  if (!rating?.visible && !error) return null;
  if (rating?.score) return <section className="itsm-satisfaction done"><strong>رضایت شما:</strong><span className="itsm-satisfaction-stars" aria-label={`${rating.score.toLocaleString("fa-IR")} از ۵`}>{[1,2,3,4,5].map(v=><i key={v} className={v<=(rating.score||0)?"on":""}/>)}</span>{rating.note && <p>{rating.note}</p>}</section>;
  if (!rating?.canRate) return error ? <p role="alert">{error}</p> : null;
  return <section className="itsm-satisfaction"><strong>از رسیدگی به این درخواست راضی بودید؟</strong><p>با ثبت امتیاز، کیفیت خدمات بهتر می‌شود.</p><div className="itsm-satisfaction-stars big" role="radiogroup" aria-label="امتیاز رضایت">{[1,2,3,4,5].map(v=><button key={v} type="button" className={v<=score?"on":""} aria-label={`${v.toLocaleString("fa-IR")} از ۵`} aria-pressed={v===score} onClick={()=>setScore(v)}/>)}</div><textarea maxLength={500} rows={2} placeholder="نظر شما (اختیاری)" value={note} onChange={event=>setNote(event.target.value)}/>{error && <p role="alert">{error}</p>}<button className="itsm-primary" disabled={busy||!score} onClick={()=>void submit()}>{busy?"در حال ثبت…":"ثبت امتیاز"}</button></section>;
}
