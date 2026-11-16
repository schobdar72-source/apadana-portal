import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
// رمز اولیه = کد پرسنلی، با تعویض اجباری در اولین ورود
const users = [
  { code: "10001", firstName: "مدیر", lastName: "منابع انسانی", role: "hr_admin" },
  { code: "10456", firstName: "کارمند", lastName: "نمونه", role: "employee" },
];

async function main() {
  for (const u of users) {
    await db.employee.upsert({
      where: { code: u.code },
      update: {},
      create: { ...u, passwordHash: await bcrypt.hash(u.code, 10), mustChangePass: true },
    });
  }
  console.log("seed ok");
}
main().finally(() => db.$disconnect());
