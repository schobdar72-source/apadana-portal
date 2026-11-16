# Apadana Portal — Phase 2 (design system + shell)

## تست ۱: بدون نصب
فایل `static/design-system.html` را در مرورگر باز کنید (پوشه را از زیپ خارج کرده باشید).

## تست ۲: Next.js (Node 18+ و اینترنت)
    npm install
    cp .env.example .env.local
    npm run dev      # http://localhost:3000/design-system
    npm run lint

## دیتابیس (PostgreSQL + Docker)
    # .env  ->  POSTGRES_PASSWORD / DATABASE_URL
    docker compose up -d          # ساخت کانتینر apadana-pg با volume
    npx prisma migrate deploy     # اجرای migration ها
    npm run db:seed               # داده‌ی اولیه (اختیاری)

بکاپ: `docker exec apadana-pg pg_dump -U postgres apadana > backup.sql`
بازگردانی: `type backup.sql | docker exec -i apadana-pg psql -U postgres -d apadana`

## فونت
`Vazirmatn-Regular.woff2` و `Vazirmatn-Bold.woff2` را در `public/fonts/` بگذارید.

## ساختار
- `src/styles/tokens.css` توکن‌ها
- `src/styles/components.css` استایل کامپوننت‌ها و سایدبار
- `src/components/ui` و `src/components/layout`
- `src/config/assets.config.ts` تعویض لوگو

## قواعد پروژه
- هر دکمه‌ی خروجی (Export) باید هم **CSV** و هم **Excel (.xlsx)** بدهد. از `src/lib/exporter.ts` (`exportCsv` / `exportXlsx`) استفاده شود؛ فایل جدید نسازید.
- چاپ/PDF جدا و با `window.print()` است.
