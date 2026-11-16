"use client";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { toJalali, toGregorian } from "@/lib/jalali";
import { validBirthDate } from "@/lib/hrCompleteness";
import { useId, useState } from "react";

const p2 = (n: number) => String(n).padStart(2, "0");
const en = (s: string) => s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));

/** فیلد تاریخ شمسی: هم نوشتنی (۱۴۰۳/۰۵/۱۲) هم انتخاب با تقویم. مقدار ذخیره‌شده: رشته‌ی شمسی YYYY/MM/DD */
export function JalaliTextDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [touched, setTouched] = useState(false);
  const id = useId();
  const m = en(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  const normalized = m ? `${m[1]}/${p2(+m[2])}/${p2(+m[3])}` : "";
  const valid = !!normalized && validBirthDate(normalized);
  const invalid = touched && !!value && !valid;
  const iso = m && valid ? (() => { const g = toGregorian(+m[1], +m[2], +m[3]); return `${g.gy}-${p2(g.gm)}-${p2(g.gd)}`; })() : undefined;
  return (
    <div>
      <label className="ui-label" htmlFor={id}>{label}</label>
      <div className={`ui-field${invalid ? " err" : ""}`} style={{ gap: 4 }}>
        <input id={id} dir="ltr" inputMode="numeric" autoComplete="off" placeholder="۱۴۰۵/۰۸/۲۱" value={value} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => onChange(en(e.target.value).replace(/[^0-9/]/g, ""))} onBlur={() => { setTouched(true); if (valid && normalized !== value) onChange(normalized); }} style={{ textAlign: "right" }} />
        <JalaliDateInput iconOnly label={label} value={iso}
          onChange={(v) => { if (!v) return onChange(""); const [y, mo, d] = v.split("-").map(Number); const j = toJalali(y, mo, d); onChange(`${j.jy}/${p2(j.jm)}/${p2(j.jd)}`); }} />
      </div>
      {invalid && <div id={`${id}-error`} className="ui-msg" role="alert">تاریخ شمسی معتبر وارد کنید؛ نمونه: ۱۴۰۵/۰۸/۲۱</div>}
    </div>
  );
}
