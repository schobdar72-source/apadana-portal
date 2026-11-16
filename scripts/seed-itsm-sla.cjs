const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
// ساعت کاری مورد تأیید کارفرما و مهلت‌های پیشنهادی؛ تعطیلات باید توسط مدیر ثبت شوند.
const policy = { weekdays: [6, 0, 1, 2, 3], start: '08:00', end: '16:00', holidays: [], targets: { critical: { response: 60, resolution: 240 }, high: { response: 120, resolution: 480 }, normal: { response: 240, resolution: 960 }, low: { response: 480, resolution: 2400 } } };
async function main() {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE "ItsmSlaPolicyVersion" IN EXCLUSIVE MODE`;
    const existing = await tx.$queryRaw`SELECT "id" FROM "ItsmSlaPolicyVersion" LIMIT 1`;
    if (existing.length) { console.log('Existing policy preserved'); return; }
    await tx.$executeRaw`INSERT INTO "ItsmSlaPolicyVersion" ("policy", "createdById") VALUES (${JSON.stringify(policy)}::jsonb, NULL)`;
    console.log('Initial policy saved; no holidays configured');
  });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
