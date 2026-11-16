import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const batch = "demo.hr-content.20261112.v1";

async function main() {
  const result = await db.$transaction(async tx => {
    if (await tx.setting.findUnique({ where: { key: `${batch}.manifest` } })) throw new Error("Demo HR content already exists; no changes made.");
    const [tehran, yazd, contact] = await Promise.all([
      tx.location.findUnique({ where: { name: "دفتر مرکزی تهران" } }),
      tx.location.findUnique({ where: { name: "سایت یزد" } }),
      tx.setting.findUnique({ where: { key: "hr.contact.v1" } }),
    ]);
    if (!tehran || !yazd) throw new Error("Demo locations not found; no changes made.");
    const createdAt = new Date().toISOString();
    const notices = [
      { id: randomUUID(), title: "اطلاعیه آزمایشی دفتر تهران", body: "این اطلاعیه نمونه برای آزمون نمایش محتوای دفتر مرکزی تهران است.", active: true, createdAt, locationIds: [tehran.id], demoBatch: batch },
      { id: randomUUID(), title: "اطلاعیه آزمایشی سایت یزد", body: "این اطلاعیه نمونه برای آزمون نمایش محتوای سایت یزد است.", active: true, createdAt, locationIds: [yazd.id], demoBatch: batch },
    ];
    await tx.setting.createMany({ data: notices.map(n => ({ key: `hr.notice.${n.id}`, value: JSON.stringify(n) })) });
    const contactValue = JSON.stringify({ phone: "02100000000", extension: "000", email: "hr-demo@example.invalid", details: "اطلاعات تماس آزمایشی؛ برای استفاده واقعی باید اصلاح شود.", demoBatch: batch });
    if (!contact) await tx.setting.create({ data: { key: "hr.contact.v1", value: contactValue } });
    await tx.setting.create({ data: { key: `${batch}.manifest`, value: JSON.stringify({ batch, noticeKeys: notices.map(n => `hr.notice.${n.id}`), contactKey: contact ? null : "hr.contact.v1", contactValue: contact ? null : contactValue, createdAt }) } });
    return { notices: notices.length, contactCreated: !contact };
  });
  console.log(JSON.stringify({ batch, ...result }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
