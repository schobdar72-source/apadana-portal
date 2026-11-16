// دریافت مناسبت‌ها و تعطیلات رسمی از https://www.time.ir/event-year
// اجرا: node scripts/sync-time-ir.mjs   (خروجی: src/data/jalali-events.json)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
const OUT = new URL("../src/data/jalali-events.json", import.meta.url);
const months = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const norm = (s) => s.replace(/اَمرداد/g, "مرداد").replace(/ي/g, "ی").replace(/ك/g, "ک");
const dg = (s) => s.replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c));
// اختیاری: node scripts/sync-time-ir.mjs page.html  (برای وقتی که صفحه را دستی ذخیره کرده‌اید)
const html = process.argv[2] ? readFileSync(process.argv[2], "utf8") : await (await fetch("https://www.time.ir/event-year", { headers: { "User-Agent": "Mozilla/5.0" } })).text();
const year = Number((html.match(/>(14\d\d)</) || [])[1]);
if (!year) throw new Error("سال در صفحه پیدا نشد");
const re = /EventListItem[^"]*__root"><span class="[^"]*__root__date([^"]*)">(\d+)<!-- --> <!-- -->([^<]+)<\/span><span class="[^"]*__root__event[^"]*">([^<]+)<\/span>/g;
const events = []; let m;
while ((m = re.exec(html))) {
  const mi = months.indexOf(norm(m[3]).trim());
  if (mi < 0) continue;
  events.push({ m: mi + 1, d: Number(dg(m[2])), title: norm(m[4]).trim(), holiday: /holiday/.test(m[1]) });
}
if (events.length < 50) throw new Error("تعداد مناسبت‌ها غیرعادی است: " + events.length);
const all = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
all[year] = { updated: new Date().toISOString().slice(0, 10), source: "https://www.time.ir/event-year", events };
writeFileSync(OUT, JSON.stringify(all, null, 1));
console.log(`سال ${year}: ${events.length} مناسبت، ${events.filter((e) => e.holiday).length} تعطیل`);
