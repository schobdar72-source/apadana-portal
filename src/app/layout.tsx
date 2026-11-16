import { PersianDigits } from "@/components/PersianDigits";
import "@/styles/components.css";
import "@/styles/home.css";
import "@/styles/home-reference.css";
import "@/styles/internal-theme.css";

export const metadata = { title: "پرتال آپادانا کاوش", icons: { icon: "/brand/logo.svg" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body><PersianDigits />{children}</body>
    </html>
  );
}
