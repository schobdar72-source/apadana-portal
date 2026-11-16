"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, Note } from "@/components/ui";
import { PortalIcon } from "@/components/PortalIcon";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { readTableFile } from "@/lib/importer";
import type { Category, DocumentItem } from "@/lib/documents";
import "@/styles/employee-directory.css";
import "@/styles/documents.css";

type Unit = { id: number; name: string; locationId: number | null };
type Person = { id: number; code: string; firstName: string; lastName: string };
type Location = { id: number; name: string };
type Data = { categories: Category[]; documents: DocumentItem[]; units?: Unit[]; employees?: Person[]; locations?: Location[] };
type SortKey = "updatedAt" | "name";
type SortDir = "asc" | "desc";
type Filters = { category: string; query: string; fileFilter: string; sortKey: SortKey; sortDir: SortDir };
type BulkEntry = { file: File; code: string; match: string | null };
const blankCategory = (): Category => ({ id: "", name: "", active: true, everyone: false, unitIds: [], employeeIds: [] });
const blankDocument = () => ({ id: "", categoryId: "", name: "", code: "", description: "", active: true, validUntil: "", reviewAt: "" });
const normalize = (text: string) => text.toLocaleLowerCase("fa").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[۰-۹٠-٩]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit) >= 0 ? "۰۱۲۳۴۵۶۷۸۹".indexOf(digit) : "٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();
const formatDate = (value: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value));
const dateValid = (value: string) => !Number.isNaN(Date.parse(value));
const formatSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت` : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
const RECENT_MS = 7 * 86400000;
const EXPIRY_WARN_DAYS = 30;
const dayDiff = (value?: string) => { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const today = new Date(); today.setHours(0, 0, 0, 0); return Math.round((Date.parse(`${value}T00:00:00`) - today.getTime()) / 86400000); };
const parseSort = (value: string | null): Pick<Filters, "sortKey" | "sortDir"> | null => { const [key, dir] = (value || "").split(":"); return (key === "name" || key === "updatedAt") && (dir === "asc" || dir === "desc") ? { sortKey: key, sortDir: dir } : null; };
const FileIcon = ({ kind }: { kind: "pdf" | "word" }) => (
  <svg className={`doc-file-ico ${kind}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
);
const categoryIcons: Record<string, string> = {
  "اکتشاف": "globe", "حراست": "shield", "مدیریت و راهبری استراتژیک": "chart",
  "طرح ریزی، پایش و بهبود سیستم": "calendar", "منابع انسانی": "users", "مالی و حسابداری": "wallet",
  "ایمنی، بهداشت، محیط زیست و انرژی (HSEE)": "shield", "فناوری اطلاعات و ارتباطات": "globe",
  "کنترل کیفیت و انبارش کالا": "book", "بازرگانی": "wallet", "مهندسی": "tool",
  "بهره برداری و ارائه خدمات": "truck", "کنترل پروژه": "chart",
};

export function Documents({ manage = false }: { manage?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Data>({ categories: [], documents: [] });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [fileFilter, setFileFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showForm, setShowForm] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);
  const [removeOriginal, setRemoveOriginal] = useState(false);
  const [history, setHistory] = useState<{ version: number; updatedAt: string; updatedBy: string; action: string; files: string[] }[] | null>(null);
  const [tab, setTab] = useState<"documents" | "categories" | "import">("documents");
  const [categoryForm, setCategoryForm] = useState<Category>(blankCategory);
  const [documentForm, setDocumentForm] = useState(blankDocument);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [importRows, setImportRows] = useState<{ name: string; code: string; row: number }[]>([]);
  const [importCategory, setImportCategory] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkList, setBulkList] = useState<BulkEntry[]>([]);
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: "ok" | "err" }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const toastSeq = useRef(0);
  const confirmResolve = useRef<((ok: boolean) => void) | null>(null);
  const filtersKey = manage ? "documents.manage.filters" : "documents.filters";

  const notify = (text: string, kind: "ok" | "err" = "ok") => { const id = ++toastSeq.current; setToasts(list => [...list, { id, text, kind }]); window.setTimeout(() => setToasts(list => list.filter(toast => toast.id !== id)), 5000); };
  const ask = (text: string) => new Promise<boolean>(resolve => { confirmResolve.current = resolve; setConfirmText(text); });
  const settleConfirm = (ok: boolean) => { setConfirmText(""); confirmResolve.current?.(ok); confirmResolve.current = null; };
  const load = async () => { const response = await fetch("/api/documents", { cache: "no-store" }); if (!response.ok) throw new Error("دریافت مستندات ممکن نشد."); setData(await response.json()); };
  useEffect(() => { load().catch(error => notify(error instanceof Error ? error.message : "دریافت مستندات ممکن نشد.", "err")).finally(() => setLoading(false)); }, []);

  // بازیابی فیلترها: اول از آدرس صفحه، بعد از حافظه مرورگر
  useEffect(() => {
    let initial: Partial<Filters> | null = null;
    if (!manage) {
      const params = new URLSearchParams(window.location.search);
      if (params.toString()) initial = { category: params.get("category") || undefined, query: params.get("q") ?? undefined, fileFilter: params.get("file") || undefined, ...(parseSort(params.get("sort")) || {}) };
    }
    if (!initial) { try { const saved = JSON.parse(localStorage.getItem(filtersKey) || "null"); if (saved && typeof saved === "object") initial = saved; } catch { /* نادیده گرفته می‌شود */ } }
    if (!initial) return;
    if (typeof initial.category === "string" && initial.category) setCategory(initial.category);
    if (typeof initial.query === "string") setQuery(initial.query);
    if (typeof initial.fileFilter === "string" && ["all", "pdf", "original", "none"].includes(initial.fileFilter)) setFileFilter(initial.fileFilter);
    if (initial.sortKey === "name" || initial.sortKey === "updatedAt") setSortKey(initial.sortKey);
    if (initial.sortDir === "asc" || initial.sortDir === "desc") setSortDir(initial.sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ذخیره فیلترها در حافظه مرورگر و آدرس صفحه (برای اشتراک لینک)
  useEffect(() => {
    try { localStorage.setItem(filtersKey, JSON.stringify({ category, query, fileFilter, sortKey, sortDir })); } catch { /* نادیده گرفته می‌شود */ }
    if (!manage) {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (query) params.set("q", query);
      if (fileFilter !== "all") params.set("file", fileFilter);
      if (sortKey !== "updatedAt" || sortDir !== "desc") params.set("sort", `${sortKey}:${sortDir}`);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, [category, query, fileFilter, sortKey, sortDir, manage, filtersKey]);

  useEffect(() => { if (!preview) return; const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setPreview(null); }; document.addEventListener("keydown", esc); return () => document.removeEventListener("keydown", esc); }, [preview]);

  const displayed = useMemo(() => data.documents.filter(item => (category === "all" || item.categoryId === category) && (fileFilter === "all" || (fileFilter === "pdf" ? item.pdf : fileFilter === "original" ? item.original : !item.pdf && !item.original)) && normalize(query).split(/\s+/).filter(Boolean).every(term => normalize(`${item.name} ${item.code} ${item.description}`).includes(term))).sort((first, second) => { const dir = sortDir === "asc" ? 1 : -1; return sortKey === "name" ? first.name.localeCompare(second.name, "fa") * dir : first.updatedAt.localeCompare(second.updatedAt) * dir; }), [data.documents, category, query, fileFilter, sortKey, sortDir]);
  const selectedCategory = data.categories.find(item => item.id === category);
  const editedItem = data.documents.find(item => item.id === documentForm.id);
  const editedCategory = data.categories.find(item => item.id === categoryForm.id);
  const documentBaseline = editedItem ? { id: editedItem.id, categoryId: editedItem.categoryId, name: editedItem.name, code: editedItem.code, description: editedItem.description, active: editedItem.active, validUntil: editedItem.validUntil || "", reviewAt: editedItem.reviewAt || "" } : blankDocument();
  const dirty = manage && (JSON.stringify(documentForm) !== JSON.stringify(documentBaseline) || JSON.stringify(categoryForm) !== JSON.stringify(editedCategory || blankCategory()) || !!pdf || !!original || removePdf || removeOriginal || importRows.length > 0);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  const switchTab = async (next: typeof tab) => { if (next !== tab && dirty && !(await ask("تغییرات ذخیره‌نشده دارید. ادامه می‌دهید؟"))) return; if (next !== tab) { resetDocument(); setCategoryForm(blankCategory()); setImportRows([]); setBulkList([]); } setTab(next); };
  const resetDocument = () => { setDocumentForm(blankDocument()); setPdf(null); setOriginal(null); setRemovePdf(false); setRemoveOriginal(false); setHistory(null); setShowForm(false); setFileKey(value => value + 1); };
  const fillForm = (item: DocumentItem) => setDocumentForm({ id: item.id, categoryId: item.categoryId, name: item.name, code: item.code, description: item.description, active: item.active, validUntil: item.validUntil || "", reviewAt: item.reviewAt || "" });
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDir(dir => dir === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); } };
  const sortMark = (key: SortKey) => sortKey === key ? <b>{sortDir === "asc" ? "▲" : "▼"}</b> : null;
  const clearFilters = () => { setQuery(""); setCategory("all"); setFileFilter("all"); setSortKey("updatedAt"); setSortDir("desc"); };
  const toggleSelect = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const categoryName = (id: string) => data.categories.find(item => item.id === id)?.name || "دسته نامشخص";

  const submitCategory = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "category", ...categoryForm }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setCategoryForm(blankCategory()); setEmployeeQuery(""); await load(); notify("دسته‌بندی ذخیره شد."); } catch (error) { notify(error instanceof Error ? error.message : "ذخیره انجام نشد.", "err"); } finally { setBusy(false); }
  };
  const sendDocument = async (values: typeof documentForm, pdfFile?: File | null, originalFile?: File | null) => {
    const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, String(value))); if (pdfFile) form.set("pdf", pdfFile); if (originalFile) form.set("original", originalFile); if (values.id && removePdf) form.set("remove_pdf", "true"); if (values.id && removeOriginal) form.set("remove_original", "true");
    const response = await fetch("/api/documents", { method: "PUT", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "ذخیره انجام نشد.");
  };
  const submitDocument = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { await sendDocument(documentForm, pdf, original); resetDocument(); await load(); notify("مدرک ذخیره شد."); } catch (error) { notify(error instanceof Error ? error.message : "ذخیره انجام نشد.", "err"); } finally { setBusy(false); }
  };
  const remove = async (kind: "category" | "document", id: string) => {
    if (!(await ask(kind === "category" ? "این دسته‌بندی حذف شود؟" : "این مدرک و فایل‌های آن حذف شود؟"))) return;
    setBusy(true); try { const response = await fetch("/api/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); if (kind === "category") setCategoryForm(blankCategory()); else resetDocument(); setSelected(current => { const next = new Set(current); next.delete(id); return next; }); await load(); notify("حذف انجام شد."); } catch (error) { notify(error instanceof Error ? error.message : "حذف انجام نشد.", "err"); } finally { setBusy(false); }
  };
  const bulkOp = async (op: "activate" | "deactivate" | "delete") => {
    if (op === "delete" && !(await ask(`${selected.size.toLocaleString("fa-IR")} مدرک و فایل‌های آن‌ها حذف شوند؟ این عمل قابل بازگشت نیست.`))) return;
    setBusy(true);
    try { const response = await fetch("/api/documents/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, ids: [...selected] }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "عملیات انجام نشد."); await load(); setSelected(new Set()); notify(op === "delete" ? "مدارک انتخاب‌شده حذف شدند." : "وضعیت مدارک انتخاب‌شده تغییر کرد."); } catch (error) { notify(error instanceof Error ? error.message : "عملیات انجام نشد.", "err"); } finally { setBusy(false); }
  };
  const selectImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("حجم فایل ورودی باید حداکثر ۵ مگابایت باشد.");
      const rows = await readTableFile(file); const headers = rows[0]?.map(value => normalize(value || "")) || [];
      const nameIndex = headers.findIndex(value => ["نام مدرک", "نام فرم", "عنوان", "نام"].includes(value));
      const codeIndex = headers.findIndex(value => ["کد مدرک", "کد فرم", "کد"].includes(value));
      if (nameIndex < 0 || codeIndex < 0) throw new Error("ستون‌های «نام مدرک» و «کد مدرک» در فایل لازم است.");
      const entries = rows.slice(1).map((row, index) => ({ name: (row[nameIndex] || "").trim(), code: (row[codeIndex] || "").trim(), row: index + 2 })).filter(row => row.name || row.code);
      if (!entries.length || entries.length > 150) throw new Error("فایل باید بین ۱ تا ۱۵۰ ردیف داشته باشد.");
      setImportRows(entries); notify(`${entries.length.toLocaleString("fa-IR")} ردیف آماده ورود است. فایل‌های مدارک جداگانه بارگذاری می‌شوند.`);
    } catch (error) { setImportRows([]); notify(error instanceof Error ? error.message : "خواندن فایل انجام نشد.", "err"); }
  };
  const importDocuments = async () => {
    if (!importCategory || !importRows.length) return;
    setBusy(true); let saved = 0;
    try {
      const known = new Set(data.documents.filter(item => item.categoryId === importCategory).map(item => normalize(item.code)));
      for (const row of importRows) { if (!row.name || !row.code || row.name.length > 200 || row.code.length > 100 || known.has(normalize(row.code))) continue; await sendDocument({ ...blankDocument(), categoryId: importCategory, name: row.name, code: row.code }); known.add(normalize(row.code)); saved++; }
      setImportRows([]); await load(); notify(`${saved.toLocaleString("fa-IR")} مدرک وارد شد؛ کدهای تکراری رد شدند. فایل‌ها را می‌توانید گروهی بارگذاری کنید.`);
    } catch (error) { await load(); notify(`${saved.toLocaleString("fa-IR")} مدرک وارد شد؛ ادامه ورود ناموفق بود: ${error instanceof Error ? error.message : "خطا"}`, "err"); } finally { setBusy(false); }
  };
  const refreshBulkMatches = (list: BulkEntry[], categoryId: string) => { const docs = data.documents.filter(item => item.categoryId === categoryId); return list.map(entry => ({ ...entry, match: docs.find(item => normalize(item.code) === entry.code)?.name || null })); };
  const pickBulkFiles = (files: FileList | File[] | null, categoryId = bulkCategory) => { const list: BulkEntry[] = [...(files || [])].slice(0, 30).map(file => ({ file, code: normalize(file.name.replace(/\.[^.]+$/, "")), match: null })); setBulkList(refreshBulkMatches(list, categoryId)); };
  const submitBulk = async () => {
    const files = bulkList.filter(entry => entry.match);
    if (!bulkCategory || !files.length) return;
    setBusy(true);
    try {
      const form = new FormData(); form.set("categoryId", bulkCategory); files.forEach(entry => form.append("files", entry.file));
      const response = await fetch("/api/documents/bulk", { method: "POST", body: form }); const result = await response.json();
      if (!response.ok) throw new Error(result.error || "بارگذاری انجام نشد.");
      setBulkList([]); await load();
      const failed = (result.results || []).filter((entry: { status: string }) => entry.status !== "ok").length;
      notify(`${(result.updated || 0).toLocaleString("fa-IR")} فایل بارگذاری شد${failed ? `؛ ${failed.toLocaleString("fa-IR")} فایل ناموفق بود` : ""}.`, failed ? "err" : "ok");
    } catch (error) { notify(error instanceof Error ? error.message : "بارگذاری انجام نشد.", "err"); } finally { setBusy(false); }
  };
  const exportCsv = () => {
    if (!displayed.length) { notify("مدرکی برای خروجی وجود ندارد.", "err"); return; }
    const escapeCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const rows = [["نام مدرک", "کد مدرک", "دسته‌بندی", "نسخه", "آخرین به‌روزرسانی", "PDF", "Word"], ...displayed.map(item => [item.name, item.code, categoryName(item.categoryId), String(item.version || 1), dateValid(item.updatedAt) ? formatDate(item.updatedAt) : "", item.pdf ? "دارد" : "ندارد", item.original ? "دارد" : "ندارد"])];
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + rows.map(row => row.map(escapeCell).join(",")).join("\n"))}`;
    link.download = "documents.csv";
    link.click();
    notify("خروجی اکسل آماده شد.");
  };
  const dropProps = (kind: string, accept: (file: File) => void) => ({
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); setDragOver(kind); },
    onDragLeave: () => setDragOver(current => current === kind ? "" : current),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); setDragOver(""); const file = event.dataTransfer.files?.[0]; if (file) accept(file); },
  });
  const badges = (item: DocumentItem) => {
    const out: JSX.Element[] = [];
    if (dateValid(item.updatedAt) && Date.now() - Date.parse(item.updatedAt) < RECENT_MS) out.push(<span key="new" className="documents-badge new">{(item.version || 1) <= 1 ? "جدید" : "به‌روز شد"}</span>);
    const validDays = dayDiff(item.validUntil);
    if (validDays !== null && validDays < 0) out.push(<span key="expired" className="documents-badge expired">منقضی شده</span>);
    else if (validDays !== null && validDays <= EXPIRY_WARN_DAYS) out.push(<span key="soon" className="documents-badge soon">{validDays.toLocaleString("fa-IR")} روز تا انقضا</span>);
    const reviewDays = dayDiff(item.reviewAt);
    if (reviewDays !== null && reviewDays <= 0) out.push(<span key="review" className="documents-badge soon">نیاز به بازبینی</span>);
    return out;
  };

  return <AppShell title={manage ? "مدیریت مستندات" : "مستندات و فرم‌ها"} activeHref={manage ? "/documents/manage" : "/documents"}>
    <div className="documents employee-directory">
      <div className="documents-heading"><div><h1>{manage ? "مدیریت مستندات و فرم‌ها" : "مستندات و فرم‌ها"}</h1><p>{manage ? "مدیریت دسته‌بندی‌ها، دسترسی‌ها و فایل‌های سازمان" : "دریافت آخرین نسخه فرم‌ها و مدارک قابل دسترس شما"}</p></div>{manage && <Link href="/documents" onClick={event => { if (!dirty) return; event.preventDefault(); void ask("تغییرات ذخیره‌نشده دارید. ادامه می‌دهید؟").then(ok => { if (ok) router.push("/documents"); }); }}>مشاهده مستندات ←</Link>}</div>
      {loading ? <div className="documents-skeleton" aria-hidden="true"><div className="sk-line" /><div className="sk-chips">{Array.from({ length: 6 }, (_, index) => <span key={index} className="sk-chip" />)}</div><div className="sk-card">{Array.from({ length: 5 }, (_, index) => <div key={index} className="sk-row" />)}</div></div> : <>
        {manage && <div className="documents-tabs" role="group" aria-label="بخش مدیریت"><button className={tab === "documents" ? "selected" : ""} onClick={() => void switchTab("documents")}>مدارک و فایل‌ها</button><button className={tab === "categories" ? "selected" : ""} onClick={() => void switchTab("categories")}>دسته‌بندی و دسترسی</button><button className={tab === "import" ? "selected" : ""} onClick={() => void switchTab("import")}>ورود از اکسل</button></div>}
        {(!manage || tab === "documents") && <>
          {!manage && <>{data.categories.length > 0 && <div className="documents-chips" role="group" aria-label="دسته‌بندی‌ها"><button className={category === "all" ? "selected" : ""} onClick={() => setCategory("all")}><PortalIcon name="doc" size={19} /><span className="chip-name">همه مستندات</span><span>{data.documents.length.toLocaleString("fa-IR")}</span></button>{data.categories.map(item => <button key={item.id} className={category === item.id ? "selected" : ""} onClick={() => setCategory(item.id)} title={item.name}><PortalIcon name={categoryIcons[item.name] || "doc"} size={19} /><span className="chip-name">{item.name}</span><span>{data.documents.filter(doc => doc.categoryId === item.id).length.toLocaleString("fa-IR")}</span></button>)}</div>}{!data.categories.length && <Note>در حال حاضر دسته‌بندی قابل دسترسی برای شما ثبت نشده است.</Note>}</>}
          {manage && <><div className="documents-actions documents-form-toggle"><button className="primary" onClick={async () => { if (showForm && dirty && !(await ask("تغییرات ذخیره‌نشده حذف شوند؟"))) return; if (showForm) resetDocument(); else setShowForm(true); }}>{showForm ? "بستن فرم" : "ثبت مدرک جدید"}</button></div>{showForm && <Card title={documentForm.id ? "ویرایش مدرک" : "ثبت مدرک جدید"}><form className="documents-form" onSubmit={submitDocument}><div className="documents-grid"><label>نام مدرک<input required maxLength={200} value={documentForm.name} onChange={event => setDocumentForm({ ...documentForm, name: event.target.value })} /></label><label>کد مدرک<input required maxLength={100} value={documentForm.code} onChange={event => setDocumentForm({ ...documentForm, code: event.target.value })} /></label><label>دسته‌بندی<select required value={documentForm.categoryId} onChange={event => setDocumentForm({ ...documentForm, categoryId: event.target.value })}><option value="">انتخاب دسته‌بندی</option>{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}{!item.active ? " (غیرفعال)" : ""}</option>)}</select></label><label>تاریخ اعتبار مدرک (اختیاری)<JalaliDateInput label="تاریخ اعتبار مدرک" value={documentForm.validUntil || undefined} onChange={value => setDocumentForm({ ...documentForm, validUntil: value || "" })} /></label><label>تاریخ بازبینی بعدی (اختیاری)<JalaliDateInput label="تاریخ بازبینی بعدی" value={documentForm.reviewAt || undefined} onChange={value => setDocumentForm({ ...documentForm, reviewAt: value || "" })} /></label><label>فایل PDF{editedItem?.pdf && <span className="documents-existing">فایل فعلی: {editedItem.pdf.name} ({formatSize(editedItem.pdf.size)}) <label className="documents-check"><input type="checkbox" checked={removePdf} onChange={event => setRemovePdf(event.target.checked)} /> حذف فایل فعلی</label></span>}<span className={`documents-drop${dragOver === "pdf" ? " is-over" : ""}`} {...dropProps("pdf", setPdf)}><input key={`pdf-${fileKey}`} type="file" accept=".pdf,application/pdf" onChange={event => setPdf(event.target.files?.[0] || null)} /><small>یا فایل را اینجا رها کنید{pdf ? ` · انتخاب شد: ${pdf.name}` : ""}</small></span></label><label>فایل اصلی Word{editedItem?.original && <span className="documents-existing">فایل فعلی: {editedItem.original.name} ({formatSize(editedItem.original.size)}) <label className="documents-check"><input type="checkbox" checked={removeOriginal} onChange={event => setRemoveOriginal(event.target.checked)} /> حذف فایل فعلی</label></span>}<span className={`documents-drop${dragOver === "original" ? " is-over" : ""}`} {...dropProps("original", setOriginal)}><input key={`original-${fileKey}`} type="file" accept=".doc,.docx" onChange={event => setOriginal(event.target.files?.[0] || null)} /><small>یا فایل را اینجا رها کنید{original ? ` · انتخاب شد: ${original.name}` : ""}</small></span></label><label className="documents-span">توضیحات اختیاری<textarea maxLength={2000} value={documentForm.description} onChange={event => setDocumentForm({ ...documentForm, description: event.target.value })} /></label></div><p className="documents-hint">هر فایل حداکثر ۱۰ مگابایت؛ در ویرایش، فایل جدید جایگزین فایل قبلی می‌شود. خالی بودن تاریخ اعتبار یعنی مدرک بدون محدودیت زمانی است.</p><label className="documents-check"><input type="checkbox" checked={documentForm.active} onChange={event => setDocumentForm({ ...documentForm, active: event.target.checked })} /> نمایش مدرک برای افراد مجاز</label><div className="documents-actions"><button className="primary" disabled={busy} type="submit">{busy ? "در حال ذخیره..." : "ذخیره مدرک"}</button>{documentForm.id && <button type="button" onClick={resetDocument}>انصراف از ویرایش</button>}</div>{history && <div className="documents-history"><strong>سابقه تغییرات</strong>{history.length ? history.map(entry => <div key={entry.version}>نسخه {entry.version.toLocaleString("fa-IR")} · {entry.action} · {entry.updatedBy} · {dateValid(entry.updatedAt) ? formatDate(entry.updatedAt) : "—"}{entry.files?.length ? ` · ${entry.files.join("، ")}` : ""}</div>) : <p>سابقه‌ای برای تغییرات قبلی ثبت نشده است.</p>}</div>}</form></Card>}</>}
          <div id="documents-list"><Card title={selectedCategory ? `مدارک ${selectedCategory.name}` : "فهرست مدارک"}><div className="documents-filters"><label>جست‌وجو<input placeholder="نام، کد یا توضیحات مدرک" value={query} onChange={event => setQuery(event.target.value)} /></label>{manage && <label>دسته‌بندی<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">همه دسته‌بندی‌ها</option>{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label>نوع فایل<select value={fileFilter} onChange={event => setFileFilter(event.target.value)}><option value="all">همه فایل‌ها</option><option value="pdf">PDF</option><option value="original">Word</option><option value="none">بدون فایل</option></select></label><label className="documents-sort-mobile">مرتب‌سازی<select value={`${sortKey}:${sortDir}`} onChange={event => { const [key, dir] = event.target.value.split(":") as [SortKey, SortDir]; setSortKey(key); setSortDir(dir); }}><option value="updatedAt:desc">جدیدترین تغییر</option><option value="updatedAt:asc">قدیمی‌ترین تغییر</option><option value="name:asc">نام مدرک (الف تا ی)</option><option value="name:desc">نام مدرک (ی تا الف)</option></select></label></div>{(category !== "all" || query || fileFilter !== "all") && <div className="documents-active-filters">{category !== "all" && <button type="button" onClick={() => setCategory("all")}>دسته‌بندی: {selectedCategory?.name || "—"}<span aria-hidden="true">✕</span></button>}{query && <button type="button" onClick={() => setQuery("")}>جست‌وجو: {query}<span aria-hidden="true">✕</span></button>}{fileFilter !== "all" && <button type="button" onClick={() => setFileFilter("all")}>نوع فایل: {fileFilter === "pdf" ? "PDF" : fileFilter === "original" ? "Word" : "بدون فایل"}<span aria-hidden="true">✕</span></button>}</div>}<div className="documents-count"><span>{displayed.length.toLocaleString("fa-IR")} مدرک</span><div className="documents-actions"><button type="button" onClick={exportCsv}>خروجی اکسل</button><button onClick={clearFilters}>پاک‌کردن فیلترها</button></div></div>{manage && selected.size > 0 && <div className="documents-bulkbar"><strong>{selected.size.toLocaleString("fa-IR")} مدرک انتخاب شده</strong><div className="documents-actions"><button type="button" onClick={() => bulkOp("activate")}>فعال‌سازی</button><button type="button" onClick={() => bulkOp("deactivate")}>غیرفعال‌سازی</button><button type="button" className="danger" disabled={busy} onClick={() => bulkOp("delete")}>حذف گروهی</button><button type="button" onClick={() => setSelected(new Set())}>لغو انتخاب</button></div></div>}<div className="emp-scroll"><table className="emp-table"><thead><tr>{manage && <th className="documents-check-col"><input type="checkbox" aria-label="انتخاب همه مدارک فهرست" checked={displayed.length > 0 && displayed.every(item => selected.has(item.id))} onChange={() => setSelected(displayed.every(item => selected.has(item.id)) ? new Set() : new Set(displayed.map(item => item.id)))} /></th>}<th className="documents-th-sort" onClick={() => toggleSort("name")}>نام مدرک{sortMark("name")}</th><th>کد مدرک</th><th>دسته‌بندی</th><th>نسخه</th><th className="documents-th-sort" onClick={() => toggleSort("updatedAt")}>آخرین به‌روزرسانی{sortMark("updatedAt")}</th><th>فایل‌ها</th>{manage && <th>عملیات</th>}</tr></thead><tbody>{displayed.map(item => <tr key={item.id}>{manage && <td data-label="انتخاب" className="documents-check-col"><input type="checkbox" aria-label={`انتخاب ${item.name}`} checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>}<td data-label="نام مدرک"><strong>{item.name}</strong>{badges(item)}{item.description && <small className="documents-description">{item.description}</small>}{manage && !item.active && <small className="documents-description">غیرفعال</small>}</td><td data-label="کد مدرک" dir="ltr">{item.code}</td><td data-label="دسته‌بندی">{categoryName(item.categoryId)}</td><td data-label="نسخه">{(item.version || 1).toLocaleString("fa-IR")}</td><td data-label="به‌روزرسانی">{dateValid(item.updatedAt) ? formatDate(item.updatedAt) : "—"}{manage && item.updatedBy && <small className="documents-description">{item.updatedBy}</small>}</td><td data-label="دانلود"><div className="documents-downloads">{item.pdf && <><button type="button" onClick={() => setPreview({ id: item.id, name: item.name })}><FileIcon kind="pdf" />پیش‌نمایش</button><a href={`/api/documents/file/${item.id}/pdf`}><FileIcon kind="pdf" />PDF · {formatSize(item.pdf.size)}</a></>}{item.original && <a href={`/api/documents/file/${item.id}/original`}><FileIcon kind="word" />Word · {formatSize(item.original.size)}</a>}{!item.pdf && !item.original && <small>فایلی ثبت نشده</small>}</div></td>{manage && <td data-label="عملیات"><div className="documents-actions"><button onClick={async () => { if (dirty && !(await ask("تغییرات ذخیره‌نشده حذف شوند؟"))) return; setShowForm(true); setRemovePdf(false); setRemoveOriginal(false); setHistory(null); fillForm(item); setPdf(null); setOriginal(null); setFileKey(value => value + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>ویرایش</button><button onClick={async () => { if (dirty && !(await ask("تغییرات ذخیره‌نشده حذف شوند؟"))) return; const response = await fetch(`/api/documents/history/${item.id}`, { cache: "no-store" }); if (!response.ok) { notify("دریافت سابقه انجام نشد.", "err"); return; } resetDocument(); setShowForm(true); fillForm(item); setHistory((await response.json()).history); window.scrollTo({ top: 0, behavior: "smooth" }); }}>سابقه</button><button className="danger" disabled={busy} onClick={() => remove("document", item.id)}>حذف</button></div></td>}</tr>)}</tbody></table></div>{!displayed.length && <Note>مدرکی با این شرایط پیدا نشد.</Note>}</Card></div>
        </>}
        {manage && tab === "categories" && <><Card title={categoryForm.id ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}><form className="documents-form" onSubmit={submitCategory}><div className="documents-grid"><label>نام دسته‌بندی<input required maxLength={100} value={categoryForm.name} onChange={event => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label></div><div className="documents-checks"><label className="documents-check"><input type="checkbox" checked={categoryForm.active} onChange={event => setCategoryForm({ ...categoryForm, active: event.target.checked })} /> دسته‌بندی فعال باشد</label><label className="documents-check"><input type="checkbox" checked={categoryForm.everyone} onChange={event => setCategoryForm({ ...categoryForm, everyone: event.target.checked })} /> همه کارکنان به این دسته دسترسی داشته باشند</label></div>{!categoryForm.everyone && <div className="documents-permissions"><fieldset><legend>واحدهای مجاز</legend>{data.units?.length ? data.units.map(item => <label className="documents-check" key={item.id}><input type="checkbox" checked={categoryForm.unitIds.includes(item.id)} onChange={event => setCategoryForm({ ...categoryForm, unitIds: event.target.checked ? [...categoryForm.unitIds, item.id] : categoryForm.unitIds.filter(id => id !== item.id) })} />{item.name} · {data.locations?.find(location => location.id === item.locationId)?.name || "محل نامشخص"}</label>) : <small>واحد فعالی ثبت نشده است.</small>}</fieldset><fieldset><legend>همکاران مجاز</legend><input placeholder="جست‌وجوی نام یا کد پرسنلی" value={employeeQuery} onChange={event => setEmployeeQuery(event.target.value)} /><div className="documents-person-list">{data.employees?.filter(person => normalize(`${person.firstName} ${person.lastName} ${person.code}`).includes(normalize(employeeQuery))).map(person => <label className="documents-check" key={person.id}><input type="checkbox" checked={categoryForm.employeeIds.includes(person.id)} onChange={event => setCategoryForm({ ...categoryForm, employeeIds: event.target.checked ? [...categoryForm.employeeIds, person.id] : categoryForm.employeeIds.filter(id => id !== person.id) })} />{person.firstName} {person.lastName} · {person.code}</label>)}</div><small>{categoryForm.employeeIds.length.toLocaleString("fa-IR")} همکار انتخاب شده</small></fieldset></div>}<div className="documents-actions"><button className="primary" disabled={busy} type="submit">ذخیره دسته‌بندی</button>{categoryForm.id && <button type="button" onClick={() => setCategoryForm(blankCategory())}>انصراف از ویرایش</button>}</div></form></Card><Card title="دسته‌بندی‌های ثبت‌شده"><label className="documents-category-search">جست‌وجوی دسته‌بندی<input value={categoryQuery} onChange={event => setCategoryQuery(event.target.value)} placeholder="نام دسته‌بندی" /></label><div className="documents-category-list">{data.categories.filter(item => normalize(item.name).includes(normalize(categoryQuery))).map(item => <div key={item.id}><div><strong>{item.name}</strong><small>{item.active ? "فعال" : "غیرفعال"} · {item.everyone ? "همه کارکنان" : item.unitIds.length || item.employeeIds.length ? `${item.unitIds.length.toLocaleString("fa-IR")} واحد و ${item.employeeIds.length.toLocaleString("fa-IR")} همکار` : "هنوز مخاطبی تعیین نشده"} · {data.documents.filter(doc => doc.categoryId === item.id).length.toLocaleString("fa-IR")} مدرک</small></div><div className="documents-actions"><button onClick={async () => { if (dirty && !(await ask("تغییرات ذخیره‌نشده حذف شوند؟"))) return; setCategoryForm(item); window.scrollTo({ top: 0, behavior: "smooth" }); }}>ویرایش</button><button className="danger" disabled={busy} onClick={() => remove("category", item.id)}>حذف</button></div></div>)}{!data.categories.length && <Note>هنوز دسته‌بندی ثبت نشده است.</Note>}</div></Card></>}
        {manage && tab === "import" && <><Card title="ورود فهرست از اکسل"><p className="documents-hint">فایل XLSX یا CSV باید ستون‌های «نام مدرک» و «کد مدرک» داشته باشد. حداکثر ۱۵۰ ردیف در هر بار؛ کدهای تکراری در دسته انتخابی وارد نمی‌شوند. این عملیات فقط مشخصات را وارد می‌کند و فایل‌های Word و PDF را می‌توانید از بخش بعدی به‌صورت گروهی بارگذاری کنید.</p><div className="documents-actions documents-template"><a href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFFنام مدرک,کد مدرک\nفرم نمونه,FR-EX-01\n")}`} download="documents-import-sample.csv">دانلود فایل نمونه CSV</a><span className="documents-hint">فایل را در اکسل باز کنید و ردیف نمونه را با اطلاعات خود جایگزین کنید.</span></div><div className="documents-grid"><label>دسته‌بندی مقصد<select value={importCategory} onChange={event => setImportCategory(event.target.value)}><option value="">انتخاب دسته‌بندی</option>{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>انتخاب فایل<span className="documents-file-picker"><span>انتخاب فایل</span><small>{importFileName || "فایلی انتخاب نشده"}</small><input type="file" accept=".xlsx,.csv" onChange={event => { const file = event.target.files?.[0]; setImportFileName(file?.name || ""); void selectImport(file); }} /></span></label></div>{importRows.length > 0 && <div className="documents-import-preview"><strong>{importRows.length.toLocaleString("fa-IR")} مدرک آماده ورود</strong>{importRows.map((row, index) => { const duplicate = data.documents.some(item => item.categoryId === importCategory && normalize(item.code) === normalize(row.code)) || importRows.slice(0, index).some(previous => normalize(previous.code) === normalize(row.code)); const invalid = !row.name || !row.code || row.name.length > 200 || row.code.length > 100; return <div key={row.row}>ردیف {row.row.toLocaleString("fa-IR")} · {row.name || "نام وارد نشده"} · {row.code || "کد وارد نشده"} · {invalid ? "اطلاعات نامعتبر" : duplicate ? "کد تکراری؛ رد می‌شود" : "آماده ورود"}</div>; })}</div>}<div className="documents-actions"><button className="primary" disabled={busy || !importCategory || !importRows.length} onClick={importDocuments}>ورود مدارک</button></div></Card>
        <Card title="بارگذاری گروهی فایل‌ها"><p className="documents-hint">نام هر فایل باید دقیقاً «کد مدرک» باشد (مثل SAMPLE-EX-001.pdf) تا به مدرک با همان کد در دسته انتخابی متصل شود. حداکثر ۳۰ فایل در هر بار؛ هر فایل تا ۱۰ مگابایت.</p><div className="documents-grid"><label>دسته‌بندی مقصد<select value={bulkCategory} onChange={event => { setBulkCategory(event.target.value); setBulkList(list => refreshBulkMatches(list, event.target.value)); }}><option value="">انتخاب دسته‌بندی</option>{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>انتخاب فایل‌ها<span className={`documents-drop documents-bulk-drop${dragOver === "bulk" ? " is-over" : ""}`} onDragOver={event => { event.preventDefault(); setDragOver("bulk"); }} onDragLeave={() => setDragOver(current => current === "bulk" ? "" : current)} onDrop={event => { event.preventDefault(); setDragOver(""); pickBulkFiles(event.dataTransfer.files); }}><input type="file" multiple accept=".pdf,.doc,.docx" onChange={event => { pickBulkFiles(event.target.files); event.target.value = ""; }} /><small>فایل‌ها را بکشید و اینجا رها کنید یا کلیک کنید</small></span></label></div>{bulkList.length > 0 && <div className="documents-import-preview documents-bulk-list"><strong>{bulkList.length.toLocaleString("fa-IR")} فایل انتخاب شده</strong>{bulkList.map((entry, index) => <div key={`${entry.file.name}-${index}`} className={entry.match ? "" : "nomatch"}>{entry.file.name} · {formatSize(entry.file.size)} · {entry.match ? `متصل به: ${entry.match}` : bulkCategory ? "کد مطابق در این دسته پیدا نشد" : "ابتدا دسته‌بندی را انتخاب کنید"}</div>)}</div>}<div className="documents-actions"><button className="primary" disabled={busy || !bulkCategory || !bulkList.some(entry => entry.match)} onClick={submitBulk}>{busy ? "در حال بارگذاری..." : `بارگذاری ${bulkList.filter(entry => entry.match).length.toLocaleString("fa-IR")} فایل`}</button>{bulkList.length > 0 && <button type="button" onClick={() => setBulkList([])}>پاک‌کردن فهرست</button>}</div></Card></>}
      </>}
    </div>
    {preview && <div className="documents-modal-bg" onClick={() => setPreview(null)}><div className="documents-preview" role="dialog" aria-modal="true" aria-label={`پیش‌نمایش ${preview.name}`} onClick={event => event.stopPropagation()}><div className="documents-preview-head"><strong>{preview.name}</strong><div className="documents-actions"><a href={`/api/documents/file/${preview.id}/pdf`}>دانلود PDF</a><button type="button" onClick={() => setPreview(null)}>بستن</button></div></div><iframe src={`/api/documents/file/${preview.id}/pdf?preview=1`} title={`پیش‌نمایش ${preview.name}`} /></div></div>}
    {confirmText && <div className="documents-modal-bg" onClick={() => settleConfirm(false)}><div className="documents-confirm" role="alertdialog" aria-modal="true" onClick={event => event.stopPropagation()}><p>{confirmText}</p><div className="documents-actions"><button className="primary" autoFocus onClick={() => settleConfirm(true)}>تأیید</button><button type="button" onClick={() => settleConfirm(false)}>انصراف</button></div></div></div>}
    <div className="documents-toasts" aria-live="polite">{toasts.map(toast => <div key={toast.id} className={`documents-toast ${toast.kind}`}>{toast.text}</div>)}</div>
  </AppShell>;
}
