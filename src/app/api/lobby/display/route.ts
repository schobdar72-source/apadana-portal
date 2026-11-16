import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { candidates, getCfg } from "@/lib/portalPeople";

export const dynamic="force-dynamic";
export async function GET() {
  try {
    const setting=await db.setting.findUnique({where:{key:"shared.portal.lobby-display.v1"}});
    const cfg=setting ? JSON.parse(setting.value) : null;
    if (!Number.isSafeInteger(cfg?.locationId) || cfg.locationId<=0) return NextResponse.json({configured:false},{headers:{"Cache-Control":"no-store"}});
    const location=await db.location.findUnique({where:{id:cfg.locationId},select:{name:true}});
    if (!location) return NextResponse.json({configured:false},{headers:{"Cache-Control":"no-store"}});
    const [people,preferences]=await Promise.all([candidates("birthday",0),getCfg("birthday")]);
    const visibleBirthdays=people.filter(p=>p.locationId===cfg.locationId && p.days===0 && (!preferences.locs.length || preferences.locs.includes(cfg.locationId)) && !preferences.hidden.includes(p.id) && (preferences.mode!=="approved" || preferences.approved.includes(p.id)));
    const photos=visibleBirthdays.length ? await db.setting.findMany({where:{key:{in:visibleBirthdays.map(p=>`portal.person.photo.${p.id}`)}},select:{key:true,value:true}}) : [];
    const photoByKey=new Map(photos.map(p=>[p.key,p.value]));
    const birthdays=visibleBirthdays.map(p=>({id:p.id,name:p.name,unit:p.unit,photo:photoByKey.get(`portal.person.photo.${p.id}`) || null}));
    let meal:null|{lunch:string;lunch2:string;off:boolean}=null;
    try {
      const menu=JSON.parse(await fs.readFile(path.join(process.cwd(),"data","cafe-menu.json"),"utf8"));
      const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      const day=Array.isArray(menu.week)?menu.week.find((d:any)=>d.iso===today):null;
      if(day)meal={lunch:String(day.lunch||""),lunch2:String(day.lunch2||""),off:!!day.off};
    } catch {}
    return NextResponse.json({configured:true,location:location.name,birthdays,meal},{headers:{"Cache-Control":"no-store"}});
  } catch {return NextResponse.json({error:"دریافت اطلاعات دفتر مرکزی ممکن نیست."},{status:503});}
}
