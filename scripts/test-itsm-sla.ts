import assert from "node:assert/strict";
import { addWorkingMinutes, workingMillisecondsBetween, isSlaPolicy, type SlaPolicy } from "../src/lib/itsm/sla";

const policy: SlaPolicy = { weekdays: [6, 0, 1, 2, 3], start: "08:00", end: "16:00", holidays: ["2026-11-15"], targets: { critical: { response: 30, resolution: 120 }, high: { response: 60, resolution: 240 }, normal: { response: 120, resolution: 480 }, low: { response: 240, resolution: 960 } } };
assert.equal(isSlaPolicy(policy), true);
assert.equal(isSlaPolicy({ ...policy, weekdays: [] }), false);
assert.equal(isSlaPolicy({ ...policy, holidays: ["2026-02-30"] }), false);
// ۱۴ نوامبر ۲۰۲۶ شنبه، ۱۵ نوامبر تعطیل ثبت شده و ۱۶ نوامبر دوشنبه است.
assert.equal(addWorkingMinutes(new Date("2026-11-14T12:00:00Z"), 60, policy).toISOString(), "2026-11-16T05:00:00.000Z");
assert.equal(addWorkingMinutes(new Date("2026-11-13T10:00:00Z"), 30, policy).toISOString(), "2026-11-14T05:00:00.000Z");
assert.equal(workingMillisecondsBetween(new Date("2026-11-14T12:00:00Z"), new Date("2026-11-16T05:00:00Z"), policy), 60 * 60000);
assert.equal(workingMillisecondsBetween(new Date("2026-11-14T05:00:00Z"), new Date("2026-11-14T05:00:00Z"), policy), 0);
console.log("PASS: working hours, weekend, holiday, Tehran timezone, validation");
