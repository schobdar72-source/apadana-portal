import Link from "next/link";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="hp-soon">
      <div className="hp-card">
        <h1>{title}</h1>
        <p>این سامانه نیازمند ورود است و در مرحله‌ی بعد به پرتال متصل می‌شود.</p>
        <Link className="hp-login" href="/">بازگشت به صفحه‌ی اصلی</Link>
      </div>
    </div>
  );
}
