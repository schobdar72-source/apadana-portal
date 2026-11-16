import { redirect } from "next/navigation";

// /admin به فهرست سفارشی‌سازی می‌رود.
export default function Page() {
  redirect("/admin/customize");
}
