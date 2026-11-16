# وضعیت: به تعویق افتاده - الزامی پیش از استقرار روی شبکه

> **تصمیم مالک:** ارتقا فعلاً انجام نمی‌شود (فقط اجرای محلی روی دستگاه توسعه).
> **قبل از هر استقرار روی شبکه (LAN یا سرور) باید انجام شود.**

## نتیجه‌ی بررسی (npm audit روی ماشین مالک)
- نسخه‌ی نصب‌شده: `next@14.2.35`، `postcss@8.4.31` (وابسته به Next).
- تمام نسخه‌های Next 9.3.4-canary تا 16.3.0-preview آسیب‌پذیرند؛ فقط خط 16 رفع شده است (npm پیشنهاد می‌دهد 16.4.5).
- **ارتقای patch در خط 14 کافی نیست** (فرض اولیه‌ی این سند اشتباه بود).
- موارد مهم: RCE بدون احراز هویت (Image Optimizer، ویندوز)، DoS در Server Components/Actions، cache poisoning، SSRF.
- PostCSS با ارتقای Next حل می‌شود؛ `overrides` کافی نیست.
- ما از Image Optimizer، Server Actions، rewrites و i18n استفاده نمی‌کنیم، ولی برای استقرار واقعی باید رفع شود.

## برنامه‌ی اصلاح‌شده
1. روی کپی پروژه کار شود، نه نسخه‌ی اصلی.
2. ارتقا به Next 16 و React 19 (و `@types/react` 19).
3. بررسی `params`/`cookies` غیرهمزمان و تایپ‌های React 19 در کد (از جمله `src/app/api/weather/route.ts`).
4. `npm run lint`، `npm run build`، سپس تست دستی.
5. **هرگز** `npm audit fix --force` روی پروژه‌ی اصلی.

---

## (قدیمی) مراحل اولیه‌ی ارتقای patch - برای خط 14 کافی نیست

## وضعیت
- `package.json`: `next ^14.2.0`، `react ^18.3.0`.
- `npm audit` روی ماشین مالک: ۱ آسیب‌پذیری بحرانی و ۱ بالا.
- `package-lock.json` در پروژه‌ی تحویلی نیست؛ نسخه‌ی دقیق روی ماشین شما از lock محلی خوانده می‌شود.
- دستیار اجرای `npm` ندارد و نمی‌تواند audit یا build را تست کند. تمام مراحل زیر روی ماشین شماست.

## اصل کار
- **هرگز** `npm audit fix --force` اجرا نشود (ممکن است نسخه‌ی major را بالا ببرد و سایت را خراب کند).
- ابتدا همان خط 14.2 به آخرین patch برود (کمترین ریسک). سپس اگر لازم بود، ارتقای major (15 یا بالاتر) جدا و با برنامه‌ی جدا انجام شود.

## مراحل (PowerShell، در پوشه‌ی `apadana-portal`)

### ۱. پشتیبان
```powershell
Copy-Item -Recurse . ..\apadana-portal-backup
git status   # اگر git دارید؛ در غیر این صورت پشتیبان کافی است
```

### ۲. وضعیت فعلی
```powershell
npm audit
npm ls next react react-dom
```
خروجی را ذخیره کنید و برای من بفرستید.

### ۳. ارتقای patch در خط 14
```powershell
npm install next@14 react@18 react-dom@18
npm audit
```
اگر `npm install next@14` آخرین patch 14 را بیاورد، معمولاً آسیب‌پذیری بحرانی بسته می‌شود. اگر نشد، `npm audit` را بفرستید.

### ۴. بررسی تایپ و build
```powershell
npm run lint
npm run build
```

### ۵. تست دستی
```powershell
npm run dev
```
این صفحه‌ها را باز کنید و بررسی کنید:
- `/design-system`
- صفحه‌ی اصلی با سایدبار و هدر
- ویجت ساعت، هوا و انتخاب شهر (حالت live با `NEXT_PUBLIC_USE_MOCK=false`)
- `/api/weather?city=tehran`

### ۶. اگر مشکل پیش آمد
```powershell
Remove-Item -Recurse -Force .next
Copy-Item ..\apadana-portal-backup\package.json .
Copy-Item ..\apadana-portal-backup\package-lock.json . -ErrorAction SilentlyContinue
npm install
```

## معیار موفقیت
- `npm audit` بدون آسیب‌پذیری بحرانی.
- `npm run build` بدون خطا.
- تمام صفحه‌های بخش تست دستی درست کار کنند.

## کار بعدی (جدا، با تأیید)
- ارتقای major به Next 15 یا بالاتر: نیاز به بررسی تغییرات API (مثل `params` و `cookies` غیرهمزمان) و تست کامل دارد.
