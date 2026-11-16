import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, Card, DataTable, Input, Kpi, Note } from "@/components/ui";

const swatches = [["brand-500", "#FFC52E"], ["brand-700", "#B88100"], ["char-800", "#2B2B2F"], ["char-700", "#3C3C40"], ["gray-100", "#EEEEF0"], ["danger", "#C62828"], ["success", "#2E7D32"]];

export default function DesignSystem() {
  return (
    <AppShell title="نمایش سیستم طراحی" activeHref="/design-system">
      <Card title="دکمه‌ها" aside="نمونه">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="primary">ثبت</Button><Button>انصراف</Button><Button variant="danger">حذف</Button><Button size="sm">کوچک</Button><Button disabled>غیرفعال</Button>
        </div>
      </Card>
      <Card title="ورودی‌ها">
        <Input label="کد پرسنلی" placeholder="۱۰۴۵۶" />
        <Input label="رمز عبور" type="password" error="رمز عبور اشتباه است" />
      </Card>
      <Card title="شاخص‌ها و برچسب‌ها">
        <div className="ui-kpis"><Kpi label="ورود موفق" value="۳۸۴" /><Kpi label="ورود ناموفق" value="۱۲" /><Kpi label="تغییر دسترسی" value="۳ مورد" /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 28 }}><Badge>عادی</Badge><Badge tone="ok">موفق</Badge><Badge tone="warn">قفل شد</Badge><Badge tone="info">ثبت شد</Badge></div>
      </Card>
      <Card title="جدول">
        <DataTable columns={["کاربر", "رخداد", "نتیجه"]} rows={[["رضا حسینی", "ورود", <Badge tone="ok" key="a">موفق</Badge>], ["۱۰۹۰۱", "ورود ناموفق", <Badge tone="warn" key="b">قفل شد</Badge>]]} />
      </Card>
      <Card title="توکن‌های رنگ" aside="tokens.css">
        <div id="tokens" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {swatches.map(([n, c]) => (
            <div key={n} style={{ textAlign: "center", fontSize: 12 }}>
              <div style={{ width: 64, height: 40, borderRadius: 10, background: c, border: "1px solid var(--c-border)" }} />{n}
            </div>
          ))}
        </div>
      </Card>
      <Note>داده‌های این صفحه نمونه هستند.</Note>
    </AppShell>
  );
}
