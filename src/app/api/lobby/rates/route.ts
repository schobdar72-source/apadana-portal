import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
type Rate = { id:string; name:string; price:number; updated:string; stale:boolean };
let cache: { items:Rate[]; fetched:number } | null = null;
const wanted = new Set(["usd","eur","gold-18k","coin-emami"]);
export async function GET() {
  try {
    if (!cache || Date.now()-cache.fetched > 15*60*1000) {
      const response=await fetch("https://nerkhara.com/api/v1/latest.json",{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});
      if (!response.ok || Number(response.headers.get("content-length") || 0)>1000000) throw new Error();
      const json=await response.json();
      if (!Array.isArray(json.items)) throw new Error();
      const items:Rate[]=json.items.filter((r:any)=>wanted.has(r.id) && r.unit==="IRT" && typeof r.price==="number" && Number.isFinite(r.price) && r.price>0 && typeof r.updated_utc==="string" && !Number.isNaN(Date.parse(r.updated_utc.endsWith("Z")?r.updated_utc:r.updated_utc+"Z"))).map((r:any)=>({id:r.id,name:typeof r.name?.fa==="string"?r.name.fa:r.id,price:r.price,updated:r.updated_utc.endsWith("Z")?r.updated_utc:r.updated_utc+"Z",stale:r.stale===true}));
      if (!items.length) throw new Error();
      cache={items,fetched:Date.now()};
    }
    return NextResponse.json({items:cache.items,stale:false},{headers:{"Cache-Control":"no-store"}});
  } catch {
    if (cache) return NextResponse.json({items:cache.items,stale:true},{headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({error:"دریافت نرخ‌ها ممکن نیست."},{status:503});
  }
}
