// ستون‌های فایل ورود/خروج پرونده‌ی کارمندان (مشترک بین صفحه و API)
export const EMP_COLS: [string, string][] = [
  ["code", "کد پرسنلی"], ["firstName", "نام"], ["lastName", "نام خانوادگی"], ["fatherName", "نام پدر"],
  ["gender", "جنسیت"], ["nationalId", "کد ملی"], ["birthCertNo", "شماره شناسنامه"], ["birthDate", "تاریخ تولد"],
  ["birthPlace", "محل تولد"], ["maritalStatus", "وضعیت تأهل"], ["education", "تحصیلات"], ["fieldOfStudy", "رشته تحصیلی"],
  ["mobile", "موبایل"], ["email", "ایمیل"], ["address", "نشانی"], ["hireDate", "تاریخ استخدام"],
  ["contractType", "نوع قرارداد"], ["status", "وضعیت"], ["endDate", "تاریخ پایان همکاری"], ["endReason", "دلیل پایان همکاری"],
  ["unit", "واحد سازمانی"], ["rank", "رتبه"], ["positionTitle", "عنوان شغلی"], ["location", "محل خدمت"],
];
export const EMP_ENUMS: Record<string, [string, string][]> = {
  gender: [["male", "مرد"], ["female", "زن"]],
  maritalStatus: [["single", "مجرد"], ["married", "متأهل"]],
  education: [["diploma", "دیپلم"], ["associate", "کاردانی"], ["bachelor", "کارشناسی"], ["master", "کارشناسی ارشد"], ["phd", "دکتری"], ["other", "سایر"]],
  contractType: [["official", "رسمی"], ["contractual", "پیمانی"], ["fixed", "قرارداد معین"], ["company", "شرکتی"]],
  status: [["active", "فعال"], ["long_leave", "مرخصی بلندمدت"], ["left", "ترک کار"], ["retired", "بازنشسته"], ["contract_ended", "پایان قرارداد"]],
};
export const EMP_RANKS: [number, string][] = [[1, "معاون"], [2, "مدیر"], [3, "رئیس"], [4, "کارشناس ارشد"], [5, "کارشناس"], [6, "کارمند"]];

const AR = /[يك]/g;
export const normText = (s: unknown) =>
  String(s ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(AR, (c) => (c === "ي" ? "ی" : "ک")).replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();
