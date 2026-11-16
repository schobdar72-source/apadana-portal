import { redirect } from "next/navigation";

// مدیریت صفحه‌ی اصلی به «سفارشی‌سازی» منتقل شد.
export default function Page() {
  redirect("/admin/customize/home");
}
