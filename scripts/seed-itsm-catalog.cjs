// افزودن موضوع‌های اولیه بدون تغییر یا جابه‌جایی موارد از پیش ثبت‌شده.
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const catalog = [
  { name: 'پشتیبانی', topics: ['روشن نشدن رایانه یا لپ‌تاپ', 'کندی یا اختلال عملکرد رایانه', 'مشکل چاپگر یا اسکنر', 'نصب یا به‌روزرسانی نرم‌افزار کاربری', 'مشکل نمایشگر، ماوس یا صفحه‌کلید', 'درخواست راه‌اندازی رایانه جدید'] },
  { name: 'زیرساخت', topics: ['قطع اتصال به شبکه سازمان', 'مشکل اتصال به اینترنت سازمان', 'درخواست دسترسی به پوشه اشتراکی', 'مشکل حساب کاربری شبکه', 'اختلال در اتصال به سرور سازمانی', 'درخواست دسترسی از راه دور'] },
  { name: 'ارتباطات', topics: ['قطع یا اختلال تلفن داخلی', 'درخواست شماره داخلی یا جابه‌جایی تلفن', 'مشکل تماس ورودی یا خروجی', 'اختلال ارتباط بین دفاتر و سایت‌ها', 'مشکل تجهیزات ارتباطی و کنفرانس', 'درخواست راه‌اندازی تلفن یا خط ارتباطی'] },
  { name: 'نرم‌افزارهای سازمانی', topics: ['مشکل ورود به نرم‌افزار سازمانی', 'درخواست دسترسی به نرم‌افزار سازمانی', 'خطا در نرم‌افزار مالی یا حسابداری', 'مشکل در سامانه منابع انسانی', 'خطا در ثبت یا ویرایش اطلاعات نرم‌افزار', 'درخواست گزارش از نرم‌افزار سازمانی'] },
  { name: 'اتوماسیون سازمانی', topics: ['مشکل ورود به اتوماسیون اداری', 'درخواست دسترسی به اتوماسیون اداری', 'خطا در ثبت یا ارسال نامه', 'مشکل در گردش و ارجاع نامه', 'مشکل مشاهده یا دانلود پیوست نامه', 'درخواست تعریف کاربر یا تغییر کارتابل'] },
];

async function main() {
  const report = [];
  await db.$transaction(async (tx) => {
    for (const group of catalog) {
      await tx.$executeRaw`INSERT INTO "ItsmGroup" ("name") VALUES (${group.name}) ON CONFLICT ("name") DO NOTHING`;
      const groups = await tx.$queryRaw`SELECT "id", "active" FROM "ItsmGroup" WHERE "name" = ${group.name}`;
      if (!groups[0]?.active) throw new Error(`واحد غیرفعال است: ${group.name}`);
      for (const topic of group.topics) {
        await tx.$executeRaw`INSERT INTO "ItsmCategory" ("name", "groupId") VALUES (${topic}, ${groups[0].id}) ON CONFLICT ("name") DO NOTHING`;
        const current = await tx.$queryRaw`SELECT "groupId", "active" FROM "ItsmCategory" WHERE "name" = ${topic}`;
        if (!current[0]?.active || current[0].groupId !== groups[0].id) throw new Error(`موضوع موجود فعال نیست یا به واحد دیگری متصل است: ${topic}`);
      }
      report.push(`${group.name}: ${group.topics.length} موضوع`);
    }
  });
  console.log(report.join('\n'));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
