"use client";
import { useRef, useState } from "react";
import { PickSelect } from "@/components/PickSelect";
import { Button, Card, Note } from "@/components/ui";
import { exportXlsx, exportXlsxSheets } from "@/lib/exporter";
import { readTableFile } from "@/lib/importer";
import { EMP_COLS, EMP_ENUMS, EMP_RANKS } from "@/lib/empSheet";

type Res = { row: number; code: string; action: string; errors: string[] };
type Sum = { create: number; update: number; skip: number; error: number };
const HEAD = EMP_COLS.map((c) => c[1]);
const AL: Record<string, string> = { create: "ایجاد", update: "به‌روزرسانی", skip: "نادیده", error: "خطا" };

export function ImportExport({ onDone, inModal = false, filteredIds }: { onDone: () => void; inModal?: boolean; filteredIds: number[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(inModal);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mode, setMode] = useState("upsert");
  const [res, setRes] = useState<{ summary: Sum; result: Res[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [fname, setFname] = useState("");
  const [busy, setBusy] = useState(false);

  const doExport = async (filtered: boolean) => {
    setBusy(true);
    try {
    setMsg("");
    const response = await fetch("/api/hr/employees?export=1");
    if (!response.ok) throw new Error("دریافت اطلاعات برای خروجی ممکن نشد.");
    const j = await response.json();
    const ids = new Set(filteredIds);
    const lab = (k: string, v: string) => EMP_ENUMS[k]?.find(([x]) => x === v)?.[1] ?? v ?? "";
    const data = (j.list ?? []).filter((e: { id: number }) => !filtered || ids.has(e.id)).map((e: Record<string, unknown>) => EMP_COLS.map(([k]) => {
      const v = k === "rank" ? EMP_RANKS.find(([n]) => n === e.positionRank)?.[1] ?? "" : k === "unit" || k === "location" ? e[k] : e[k];
      return lab(k, String(v ?? ""));
    }));
    exportXlsx(filtered ? "employees-filtered" : "employees", HEAD, data);
    } catch (e) { setMsg(e instanceof Error ? e.message : "خطا در تهیه خروجی."); }
    finally { setBusy(false); }
  };

  const template = () => exportXlsxSheets("employees-template", [
    { name: "کارمندان", head: HEAD, rows: [["1001", "علی", "رضایی", "", "مرد", "0012345678", "", "1370/05/12", "", "متأهل", "کارشناسی", "", "09120000000", "", "", "1400/01/01", "رسمی", "فعال", "", "", "", "کارشناس", "", ""]] },
    { name: "راهنما", head: ["ستون", "توضیح"], rows: [
      ["کد پرسنلی", "اجباری و یکتا؛ رمز اولیه‌ی کارمند جدید همین کد است."],
      ["نام و نام خانوادگی", "برای کارمند جدید اجباری است."],
      ...Object.entries(EMP_ENUMS).map(([k, o]) => [EMP_COLS.find((c) => c[0] === k)![1], o.map((x) => x[1]).join(" / ")]),
      ["رتبه", EMP_RANKS.map((x) => x[1]).join(" / ")],
      ["تاریخ‌ها", "شمسی، مانند 1403/05/12"],
      ["واحد سازمانی", "نام واحد یا مسیر کامل مانند «الف › ب»"],
      ["ردیف خالی", "در حالت به‌روزرسانی، خانه‌ی خالی مقدار قبلی را تغییر نمی‌دهد."],
    ] },
  ]);

  const pick = async (file?: File) => {
    if (!file) return;
    setFname(file.name);
    setMsg(""); setRes(null);
    try {
      const t = await readTableFile(file);
      const hi = t.findIndex((r) => r.some((c) => c?.trim() === "کد پرسنلی"));
      if (hi < 0) { setMsg("سطر عنوان (کد پرسنلی، نام، ...) در فایل پیدا نشد. از فایل نمونه استفاده کنید."); return; }
      const h = t[hi].map((c) => (c ?? "").trim());
      const data = t.slice(hi + 1).filter((r) => r.some((c) => (c ?? "").trim())).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
      setRows(data);
      await send(data, true);
    } catch (e) { setMsg((e as Error).message); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async (data: Record<string, string>[], dryRun: boolean) => {
    setBusy(true);
    const r = await fetch("/api/hr/employees/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: data, mode, dryRun }) });
    const j = await r.json(); setBusy(false);
    if (j.summary) setRes(j);
    if (!r.ok && !j.summary) { setMsg(j.error ?? "خطا"); return; }
    if (!dryRun && r.ok) { setMsg(`ورود انجام شد: ${j.summary.create} ایجاد، ${j.summary.update} به‌روزرسانی.`); setRows([]); setRes(null); onDone(); }
    else if (!dryRun) setMsg(j.error);
  };

  const errFile = () => exportXlsx("import-errors", ["ردیف", "کد پرسنلی", "خطا"], (res?.result ?? []).filter((r) => r.action === "error").map((r) => [String(r.row), r.code, r.errors.join("؛ ")]));

  return (
    <Card title={inModal ? undefined : "ورود و خروج اطلاعات"} aside={inModal ? undefined : <Button onClick={() => setOpen(!open)}>{open ? "بستن" : "باز کردن"}</Button>}>
      {open && (
        <div className="emp-io-content">
          <div className="emp-io-section">
            <div className="emp-io-heading"><strong>دریافت اطلاعات</strong><span>خروجی اکسل یا فایل نمونه را دریافت کنید.</span></div>
            <div className="emp-io-actions">
            <Button onClick={() => doExport(false)} disabled={busy}>خروجی اکسل همه‌ی کارمندان</Button>
            <Button onClick={() => doExport(true)} disabled={busy || !filteredIds.length}>خروجی نتایج فیلترشده ({filteredIds.length.toLocaleString("fa-IR")} نفر)</Button>
            <Button onClick={template}>دانلود فایل نمونه</Button>
            </div>
          </div>
          <div className="emp-io-section">
            <div className="emp-io-heading"><strong>ورود اطلاعات</strong><span>فایل اکسل یا CSV را انتخاب کنید؛ پیش از ذخیره، نتیجه بررسی نمایش داده می‌شود.</span></div>
            <div className="emp-io-import">
            <div className="emp-io-mode"><PickSelect label="حالت ورود" value={mode} onChange={(v) => { setMode(v); setRes(null); setRows([]); }} options={[["upsert", "ایجاد جدید و به‌روزرسانی موجود"], ["create", "فقط ایجاد کارمند جدید"], ["update", "فقط به‌روزرسانی موجود"]]} /></div>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>انتخاب فایل اکسل / CSV</Button>
            {fname && <span style={{ fontSize: 13, opacity: 0.8 }}>{fname}</span>}
            </div>
          </div>
          {msg && <Note>{msg}</Note>}
          {res && (
            <>
              <Note>پیش‌نمایش: {res.summary.create} ایجاد · {res.summary.update} به‌روزرسانی · {res.summary.skip} نادیده · {res.summary.error} خطا</Note>
              {res.summary.error > 0 && (
                <div className="emp-scroll"><table className="emp-table" style={{ width: "100%" }}>
                  <thead><tr><th>ردیف</th><th>کد</th><th>خطا</th></tr></thead>
                  <tbody>{res.result.filter((r) => r.action === "error").slice(0, 50).map((r) => <tr key={r.row}><td>{r.row}</td><td>{r.code}</td><td>{r.errors.join("؛ ")}</td></tr>)}</tbody>
                </table></div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" disabled={busy || res.summary.error > 0 || res.summary.create + res.summary.update === 0} onClick={() => send(rows, false)}>تأیید و ذخیره</Button>
                {res.summary.error > 0 && <Button onClick={errFile}>دانلود فایل خطاها</Button>}
              </div>
              {res.summary.error > 0 && <Note>با وجود حتی یک خطا چیزی ذخیره نمی‌شود؛ فایل را اصلاح و دوباره انتخاب کنید.</Note>}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
