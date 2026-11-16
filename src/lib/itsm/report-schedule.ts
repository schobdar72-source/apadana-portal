import { toJalali } from "../jalali";

export type ScheduleSpec={frequency:"daily"|"weekly"|"monthly";hour:number;minute:number;day:number};
export function validSchedule(value:unknown):value is ScheduleSpec {
 if(!value || typeof value!=="object")return false;
 const x=value as ScheduleSpec;
 return ["daily","weekly","monthly"].includes(x.frequency) && Number.isInteger(x.hour) && x.hour>=0 && x.hour<=23 && Number.isInteger(x.minute) && x.minute>=0 && x.minute<=59 && Number.isInteger(x.day) && x.day>=1 && x.day<=(x.frequency==='weekly'?7:28);
}
// زمان محلی تهران؛ محاسبه با Intl از تغییرات احتمالی ساعت رسمی پیروی می‌کند.
const localParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(d:Date){return Object.fromEntries(localParts.formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
function localInstant(y:number,m:number,d:number,h:number,minute:number){const target=Date.UTC(y,m-1,d,h,minute);let n=target;for(let i=0;i<5;i++){const p=parts(new Date(n));const delta=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);if(!delta)return new Date(n);n+=delta;}throw Error('Invalid Tehran local time');}
export function nextReportRun(spec:ScheduleSpec,after:Date){
 if(!validSchedule(spec)||!Number.isFinite(after.getTime()))throw Error('Invalid report schedule');
 const p=parts(after), start=Date.UTC(p.year,p.month-1,p.day);
 for(let offset=0;offset<70;offset++){
  const day=new Date(start+offset*86400000),y=day.getUTCFullYear(),m=day.getUTCMonth()+1,d=day.getUTCDate();
  const weekday=(day.getUTCDay()+1)%7+1;
  if(spec.frequency==='weekly'&&weekday!==spec.day)continue;
  if(spec.frequency==='monthly'&&toJalali(y,m,d).jd!==spec.day)continue;
  const candidate=localInstant(y,m,d,spec.hour,spec.minute);if(candidate>after)return candidate;
 }
 throw Error('Unable to calculate next report run');
}
