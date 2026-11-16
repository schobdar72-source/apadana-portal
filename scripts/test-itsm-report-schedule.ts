import assert from 'node:assert/strict';
import { nextReportRun, validSchedule } from '../src/lib/itsm/report-schedule';
import { toJalali } from '../src/lib/jalali';

const start=new Date('2026-11-15T00:00:00Z');
assert.equal(nextReportRun({frequency:'daily',hour:8,minute:0,day:1},start).toISOString(),'2026-11-15T04:30:00.000Z');
assert.equal(nextReportRun({frequency:'weekly',hour:8,minute:0,day:1},start).toISOString(),'2026-11-21T04:30:00.000Z');
const monthly=nextReportRun({frequency:'monthly',hour:8,minute:0,day:1},start);
const tehran=new Date(monthly.getTime()+210*60000);
assert.equal(toJalali(tehran.getUTCFullYear(),tehran.getUTCMonth()+1,tehran.getUTCDate()).jd,1);
assert.equal(validSchedule({frequency:'weekly',hour:8,minute:0,day:8}),false);
assert.equal(validSchedule({frequency:'monthly',hour:8,minute:0,day:29}),false);
console.log('PASS: Tehran daily, weekly, Jalali monthly and validation');
