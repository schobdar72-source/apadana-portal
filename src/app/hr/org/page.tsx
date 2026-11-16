"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { PageFrame } from "@/components/PageFrame";
import { Button, Card, Note } from "@/components/ui";
import { RANKS } from "@/lib/orgRanks";
import Link from "next/link";
import "@/styles/org-directory.css";

type Unit = { id: number; name: string; parentId: number | null; active: boolean; headId: number | null; locationId: number | null };
type Loc = { id: number; name: string; kind: string; active: boolean };
type Data = { units: Unit[]; locations: Loc[]; levels: number; counts: Record<number, number>; locationCounts: Record<number, number>; activeEmployees: number; withoutUnit: number; people?: { id: number; code: string; name: string; unitId: number; title: string | null; rank: number | null }[] };
type SearchResult = { code: string; name: string; active: boolean; unit: string | null; title: string | null; location: string | null };

async function call(body: object) {
  try { const r = await fetch("/api/hr/org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); return r.ok ? "" : (j.error as string) || "خطا در ثبت اطلاعات";
  } catch { return "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید."; }
}

export default function OrgPage() {
  const [d, setD] = useState<Data | null>(null);
  const [denied, setDenied] = useState("");
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [unitLocation, setUnitLocation] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [lname, setLname] = useState("");
  const [kind, setKind] = useState("office");
  const [pend, setPend] = useState<{ id: number; parentId: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [empCode, setEmpCode] = useState("");
  const [empQuery, setEmpQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRequest = useRef(0);
  const [empUnit, setEmpUnit] = useState("");
  const [empTitle, setEmpTitle] = useState("");
  const [empRank, setEmpRank] = useState("");
  const [empMgr, setEmpMgr] = useState("");
  const [empHead, setEmpHead] = useState(false);
  const [found, setFound] = useState<{ code: string; name: string; active: boolean; unit: string | null; title: string | null; unitId: number | null; rank: number | null; managerCode: string; isHead: boolean } | null | "none">(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ kind: "rename-unit" | "add-child" | "rename-location"; id: number; name: string } | null>(null);

  const search = async () => {
    const q = empQuery.trim();
    if (!q) return;
    const request = ++searchRequest.current;
    setFound(null); setEmpCode(""); setResults(null); setSearchError(""); setSearchBusy(true);
    try {
      const r = await fetch(`/api/hr/org?search=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error();
      const j = await r.json();
      if (request === searchRequest.current) { setResults(j.results); setHasMore(j.hasMore); }
    } catch { if (request === searchRequest.current) setSearchError("جست‌وجوی کارکنان ممکن نشد؛ دوباره تلاش کنید."); }
    finally { if (request === searchRequest.current) setSearchBusy(false); }
  };

  const chooseEmployee = async (code: string) => {
    const request = ++searchRequest.current;
    setSearchError(""); setSearchBusy(true); setFound(null); setEmpCode("");
    try {
      const r = await fetch(`/api/hr/org?code=${encodeURIComponent(code)}`);
      if (!r.ok) throw new Error();
      const j = await r.json();
      if (request !== searchRequest.current) return;
      if (!j.employee) { setSearchError("اطلاعات این کارمند پیدا نشد؛ دوباره جست‌وجو کنید."); return; }
      setFound(j.employee); setEmpCode(j.employee.code); setResults(null);
      setEmpUnit(String(j.employee.unitId || "")); setEmpTitle(j.employee.title || ""); setEmpRank(String(j.employee.rank || "")); setEmpMgr(j.employee.managerCode || ""); setEmpHead(!!j.employee.isHead);
    } catch { if (request === searchRequest.current) setSearchError("دریافت اطلاعات کارمند ممکن نشد؛ دوباره تلاش کنید."); }
    finally { if (request === searchRequest.current) setSearchBusy(false); }
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/hr/org");
    if (!r.ok) { setDenied(r.status === 401 || r.status === 403 ? "دسترسی به این صفحه فقط برای مدیر منابع انسانی است." : `خطای سرور (${r.status}). ترمینال را ببینید؛ احتمالاً migrate اجرا نشده یا سرور ری‌استارت نشده است.`); return; }
    setD(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (body: object) => { setErr(""); const e = await call(body); setErr(e); if (!e) await load(); return !e; };

  const depthOf = (u: Unit, all: Unit[]): number => (u.parentId ? 1 + depthOf(all.find((x) => x.id === u.parentId)!, all) : 1);
  const childrenOf = (id: number | null) => d!.units.filter((u) => u.parentId === id);
  const rows = (parentId: number | null, all: Unit[], hide: Set<number>): Unit[] =>
    all.filter((u) => u.parentId === parentId && !hide.has(u.id)).flatMap((u) => [u, ...rows(u.id, all, hide)]);
  const toggleCollapse = (id: number) => setCollapsed((s) => { const c = new Set(s); if (c.has(id)) c.delete(id); else c.add(id); return c; });
  const descendantIds = (id: number, all: Unit[]): number[] => all.filter((u) => u.parentId === id).flatMap((u) => [u.id, ...descendantIds(u.id, all)]);

  const hidden = new Set<number>(d ? d.units.filter((u) => collapsed.has(u.id)).flatMap((u) => descendantIds(u.id, d.units)) : []);
  const matches = new Set<number>();
  if (d) for (const u of d.units) if ((!filter.trim() || u.name.includes(filter.trim())) && (status === "all" || u.active === (status === "active")) && (!locationFilter || (locationFilter === "none" ? u.locationId === null : u.locationId === Number(locationFilter)))) { let cur: Unit | undefined = u; while (cur && !matches.has(cur.id)) { matches.add(cur.id); cur = d.units.find(x => x.id === cur!.parentId); } }
  const selectedUnit = d?.units.find(u => u.id === selected);

  const mgrCandidates = () => {
    if (!d) return [];
    const chain = new Set<number>(); let cur = d.units.find((u) => u.id === Number(empUnit));
    while (cur && !chain.has(cur.id)) { chain.add(cur.id); cur = d.units.find((u) => u.id === cur!.parentId); }
    const r = Number(empRank) || 99;
    return (d.people || []).filter((p) => p.code !== empCode && chain.has(p.unitId) && (p.rank ?? 99) < r)
      .sort((a, b) => (a.unitId === Number(empUnit) ? 0 : 1) - (b.unitId === Number(empUnit) ? 0 : 1) || (b.rank ?? 99) - (a.rank ?? 99));
  };

  return (
    <PageFrame id="hr" title="ساختار سازمانی" activeHref="/hr/org">
      {denied && <Note>{denied}</Note>}
      {d && (
        <div className="org-page">
          {err && <Note>{err}</Note>}
          <div className="org-summary"><div><span>واحدهای فعال</span><strong>{d.units.filter(u => u.active).length.toLocaleString("fa-IR")}</strong></div><div><span>محل‌های خدمت فعال</span><strong>{d.locations.filter(l => l.active).length.toLocaleString("fa-IR")}</strong></div><div><span>کارکنان فعال بدون واحد</span><strong>{d.withoutUnit.toLocaleString("fa-IR")}</strong><Link href="/hr/employees?issue=unit">مشاهده پرونده‌ها</Link></div></div>
          <Card title="واحدهای سازمانی" aside={
            <label className="org-levels">تعداد سطح‌ها{" "}
              <select className="org-input" value={d.levels} onChange={(e) => run({ op: "levels", value: e.target.value })}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n.toLocaleString("fa-IR")}</option>)}
              </select>
            </label>
          }>
            {d.units.some(u => u.locationId === null) && <p className="org-hint">محل خدمت برخی واحدهای قبلی تعیین نشده است. برای تعیین محل، ابتدا محل خدمت کارکنان و زیرواحدهای آن را بررسی کنید.</p>}
            <div className="org-form">
              <input className="org-input org-grow" placeholder="نام واحد جدید" value={name} onChange={(e) => setName(e.target.value)} />
              <select className="org-input" aria-label="محل خدمت واحد جدید" value={unitLocation} onChange={e => { setUnitLocation(e.target.value); setParent(""); }}><option value="">محل خدمت واحد را انتخاب کنید</option>{d.locations.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <select className="org-input" value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">واحد سازمانی (سطح ۱)</option>
                {d.units.filter((u) => u.active && u.locationId === Number(unitLocation) && depthOf(u, d.units) < d.levels).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <Button variant="primary" disabled={!unitLocation || !name.trim()} onClick={async () => { if (await run({ op: "unit.add", name, parentId: parent || null, locationId: unitLocation })) setName(""); }}>افزودن</Button>
              <Button size="sm" onClick={() => setCollapsed(new Set())}>باز کردن همه</Button>
              <Button size="sm" onClick={() => setCollapsed(new Set(d.units.filter((u) => childrenOf(u.id).length > 0).map((u) => u.id)))}>بستن همه</Button>
            </div>
            <div className="org-filter"><label>جست‌وجوی واحد<input className="org-input" value={filter} onChange={e => setFilter(e.target.value)} placeholder="نام واحد سازمانی" /></label><label>محل خدمت<select className="org-input" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}><option value="">همه محل‌ها</option><option value="none">محل تعیین نشده</option>{d.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>وضعیت<select className="org-input" value={status} onChange={e => setStatus(e.target.value)}><option value="all">همه واحدها</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></label></div>
            {d.units.length === 0 && <Note>هنوز واحدی ثبت نشده است.</Note>}
            {d.units.length > 0 && matches.size === 0 && <Note>واحدی با این شرایط پیدا نشد.</Note>}
            {rows(null, d.units, filter || status !== "all" || locationFilter ? new Set() : hidden).filter(u => matches.has(u.id)).map((u) => {
              const banned = new Set([u.id, ...descendantIds(u.id, d.units)]);
              const isPending = pend?.id === u.id;
              const subCount = descendantIds(u.id, d.units).length;
              const kids = childrenOf(u.id);
              const count = d.counts?.[u.id] ?? 0;
              return (
                <Fragment key={u.id}>
                  <div className={(isPending ? "org-row org-row-pending" : "org-row") + (selected === u.id ? " org-row-selected" : "")} style={{ marginRight: (depthOf(u, d.units) - 1) * 20 }}>
                    <button className="org-arrow" disabled={kids.length === 0} onClick={() => toggleCollapse(u.id)} aria-label="باز و بسته">{kids.length > 0 ? (collapsed.has(u.id) ? "◂" : "▾") : "·"}</button>
                    <button className="org-name org-unit-button" onClick={() => setSelected(selected === u.id ? null : u.id)}>{u.name} {!u.active && <span className="org-inactive">غیرفعال</span>}</button>
                    <span className="org-hint">{count.toLocaleString("fa-IR")} نفر مستقیم · {descendantIds(u.id, d.units).reduce((n, id) => n + (d.counts[id] ?? 0), 0).toLocaleString("fa-IR")} نفر زیرمجموعه{kids.length > 0 && ` · ${kids.length.toLocaleString("fa-IR")} زیرواحد`}</span>
                    <select className="org-input" aria-label={`محل خدمت واحد ${u.name}`} value={u.locationId ?? ""} onChange={e => { const id = e.target.value; if (id && window.confirm(`محل خدمت «${u.name}» و ${subCount.toLocaleString("fa-IR")} زیرواحد آن تعیین شود؟`)) void run({ op: "unit.location", id: u.id, locationId: id }); }}><option value="">محل تعیین نشده</option>{d.locations.filter(l => l.active || l.id === u.locationId).map(l => <option key={l.id} value={l.id}>{l.name}{!l.active ? " (غیرفعال)" : ""}</option>)}</select>
                    <select className="org-input" value={pend && isPending ? pend.parentId : (u.parentId ?? "")} onChange={(e) => setPend(e.target.value === String(u.parentId ?? "") ? null : { id: u.id, parentId: e.target.value })}>
                      <option value="">واحد سازمانی (سطح ۱)</option>
                      {d.units.filter((p) => p.active && p.locationId === u.locationId && !banned.has(p.id) && depthOf(p, d.units) < d.levels).map((p) => (
                        <option key={p.id} value={p.id}>{"— ".repeat(depthOf(p, d.units) - 1)}{p.name}</option>
                      ))}
                    </select>
                    <div className="org-actions">
                    <Button size="sm" disabled={!u.active || !u.locationId || depthOf(u, d.units) >= d.levels} title={!u.locationId ? "ابتدا محل خدمت واحد را تعیین کنید" : undefined} onClick={() => setDialog({ kind: "add-child", id: u.id, name: "" })}>+ زیرواحد</Button>
                    <div className="org-menu-wrap">
                      <button className="org-more" aria-label="عملیات بیشتر" onClick={() => setMenu(menu === u.id ? null : u.id)}>⋯</button>
                      {menu === u.id && (
                        <>
                          <div className="org-menu-backdrop" onClick={() => setMenu(null)} />
                          <div className="org-menu">
                            <button onClick={() => { setMenu(null); setDialog({ kind: "rename-unit", id: u.id, name: u.name }); }}>ویرایش نام</button>
                            <button onClick={() => { setMenu(null); if (!u.active || window.confirm(`واحد «${u.name}» غیرفعال شود؟ اطلاعات ${count.toLocaleString("fa-IR")} کارمند مستقیم و ${subCount.toLocaleString("fa-IR")} زیرواحد حفظ می‌شود.`)) run({ op: "unit.edit", id: u.id, active: !u.active }); }}>{u.active ? "غیرفعال کردن" : "فعال کردن"}</button>
                            <button className="org-danger" onClick={async () => { setMenu(null); if (window.confirm(`واحد «${u.name}» حذف شود؟`)) await run({ op: "unit.delete", id: u.id }); }}>حذف واحد</button>
                          </div>
                        </>
                      )}
                    </div>
                    </div>
                  </div>
                  {isPending && (
                    <div className="org-pending-bar" style={{ marginRight: (depthOf(u, d.units) - 1) * 24 }}>
                      <span className="org-hint">
                        {subCount > 0 ? `${subCount.toLocaleString("fa-IR")} واحد زیرمجموعه هم سطحشان تغییر می‌کند. ` : ""}
                        تغییر والد «{u.name}» ذخیره نشده است.
                      </span>
                      <div className="org-pending-actions">
                        <Button size="sm" variant="primary" onClick={async () => { if (await run({ op: "unit.edit", id: u.id, parentId: pend.parentId || null })) setPend(null); }}>ذخیره جابه‌جایی</Button>
                        <Button size="sm" onClick={() => setPend(null)}>انصراف</Button>
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
            {selectedUnit && <div className="org-detail"><strong>جزئیات {selectedUnit.name}</strong><p>محل خدمت: {d.locations.find(l => l.id === selectedUnit.locationId)?.name || "تعیین نشده"} · واحد بالادستی: {d.units.find(u => u.id === selectedUnit.parentId)?.name || "سطح اول"} · {selectedUnit.active ? "فعال" : "غیرفعال"}</p><p>کارکنان مستقیم این واحد:</p><div className="org-people">{(d.people || []).filter(p => p.unitId === selectedUnit.id).map(p => <Link key={p.id} href={`/hr/employees?open=${p.id}`}>{p.name} <span>{p.title || "عنوان ثبت نشده"}</span></Link>)}{!(d.people || []).some(p => p.unitId === selectedUnit.id) && <span>کارمند فعالی ثبت نشده است.</span>}</div></div>}
          </Card>

          <Card title="تخصیص پرسنل به واحد">
            <div className="org-form">
              <input className="org-input org-employee-search" aria-label="جست‌وجوی کارمند با نام، نام خانوادگی یا کد پرسنلی" placeholder="نام، نام خانوادگی یا کد پرسنلی" value={empQuery} onChange={(e) => { searchRequest.current++; setEmpQuery(e.target.value); setFound(null); setEmpCode(""); setResults(null); setSearchError(""); setSearchBusy(false); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
              <Button onClick={search} disabled={!empQuery.trim() || searchBusy}>{searchBusy ? "در حال جست‌وجو..." : "جستجو"}</Button>
              <select className="org-input org-grow" value={empUnit} onChange={(e) => { setEmpUnit(e.target.value); setEmpMgr(""); setEmpHead(false); }}>
                <option value="">واحد را انتخاب کنید</option>
                {rows(null, d.units, new Set()).filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{"— ".repeat(depthOf(u, d.units) - 1)}{u.name} · {d.locations.find(l => l.id === u.locationId)?.name || "محل تعیین نشده"}</option>)}
              </select>
            </div>
            {searchError && <div className="org-search-message" role="alert">{searchError}</div>}
            {results && <div className="org-search-results" aria-label="نتایج جست‌وجوی کارکنان" aria-live="polite"><strong>{results.length ? "کارمند موردنظر را انتخاب کنید" : "کارمندی با این مشخصات پیدا نشد."}</strong>{results.map(person => <button type="button" key={person.code} disabled={searchBusy || !person.active} onClick={() => void chooseEmployee(person.code)}><span><b>{person.name}</b><small>کد پرسنلی: {person.code}{!person.active && " · غیرفعال"}</small></span><span>{person.unit || "بدون واحد"}<small>{person.location || "محل خدمت ثبت نشده"}{person.title ? ` · ${person.title}` : ""}</small></span></button>)}{hasMore && <p>نتایج بیشتری وجود دارد؛ برای پیدا کردن فرد موردنظر عبارت دقیق‌تری وارد کنید.</p>}</div>}
            {found && found !== "none" && (
              <div className="org-hint" style={{ marginBottom: 8 }}>
                {found.name} | کد {found.code} | واحد فعلی: {found.unit || "بدون واحد"} | عنوان: {found.title || "-"} {found.active ? "" : "| (غیرفعال)"}
              </div>
            )}
            {found === "none" && <div className="org-hint" style={{ marginBottom: 8 }}>پرسنلی با این کد پیدا نشد.</div>}
            <div className="org-form">
              <input className="org-input org-grow" placeholder="عنوان شغلی (مثلاً کارشناس مالیات)" value={empTitle} onChange={(e) => setEmpTitle(e.target.value)} />
              <select className="org-input" value={empRank} onChange={(e) => { setEmpRank(e.target.value); setEmpMgr(""); }}>
                <option value="">رتبه</option>
                {RANKS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
              <select className="org-input" value={empMgr} onChange={(e) => setEmpMgr(e.target.value)} disabled={!empUnit}>
                <option value="">{empUnit ? "بدون مدیر مستقیم" : "ابتدا واحد را انتخاب کنید"}</option>
                {empMgr && !mgrCandidates().some(p => p.code === empMgr) && <option value={empMgr}>مدیر فعلی ({empMgr})؛ نیازمند بازبینی</option>}
                {mgrCandidates().map((p) => <option key={p.id} value={p.code}>{p.name} | {p.title || "-"} | {p.code}</option>)}
              </select>
              {empUnit && mgrCandidates().length === 0 && <div className="org-hint" style={{ width: "100%" }}>کارمند بالادستی با رتبه بالاتر در این زنجیره واحد ثبت نشده است؛ مدیر مستقیم خالی می‌ماند.</div>}
              {found && found !== "none" && <div className="org-hint" style={{ width: "100%" }}>اطلاعات فعلی بارگذاری شده است؛ ذخیره، واحد، عنوان شغلی، رتبه و مدیر مستقیم انتخاب‌شده را ثبت می‌کند.</div>}
              <label className="org-hint"><input type="checkbox" checked={empHead} onChange={(e) => setEmpHead(e.target.checked)} /> مسئول این واحد</label>
              <Button variant="primary" disabled={!empUnit || !found || found === "none" || !found.active || found.code !== empCode.trim()} onClick={async () => { const unit = d.units.find(u => u.id === Number(empUnit)); const oldHead = d.people?.find(p => p.id === unit?.headId); if (empHead && unit?.headId && oldHead?.code !== empCode.trim() && !window.confirm(`مسئول فعلی ${oldHead?.name || "واحد"} است. مسئول واحد تغییر کند؟`)) return; if (await run({ op: "emp.assign", code: empCode, unitId: empUnit, title: empTitle, rank: empRank, managerCode: empMgr, isHead: empHead })) { setEmpCode(""); setEmpQuery(""); setResults(null); setEmpUnit(""); setEmpTitle(""); setEmpRank(""); setEmpMgr(""); setEmpHead(false); setFound(null); } }}>تخصیص</Button>
            </div>
          </Card>

          <Card title="محل‌های خدمت">
            <div className="org-form">
              <input className="org-input org-grow" placeholder="نام محل (مثلاً دفتر تهران)" value={lname} onChange={(e) => setLname(e.target.value)} />
              <select className="org-input" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="office">دفتر</option>
                <option value="mine">معدن</option>
              </select>
              <Button variant="primary" onClick={async () => { if (await run({ op: "loc.add", name: lname, kind })) setLname(""); }}>افزودن</Button>
            </div>
            {d.locations.length === 0 && <Note>هنوز محلی ثبت نشده است.</Note>}
            {d.locations.map((l) => (
              <div key={l.id} className="org-row" style={{ opacity: l.active ? 1 : 0.5 }}>
                <b className="org-name">{l.name}{!l.active && " (غیرفعال)"}</b>
                <select className="org-input" value={l.kind} onChange={(e) => run({ op: "loc.edit", id: l.id, kind: e.target.value })}>
                  <option value="office">دفتر</option>
                  <option value="mine">معدن</option>
                </select>
                <span className="org-hint">{(d.locationCounts[l.id] || 0).toLocaleString("fa-IR")} کارمند فعال</span>
                <Button size="sm" onClick={() => setDialog({ kind: "rename-location", id: l.id, name: l.name })}>ویرایش نام</Button>
                <Button size="sm" variant={l.active ? "default" : "primary"} onClick={() => { if (!l.active || window.confirm(`محل «${l.name}» غیرفعال شود؟ محل خدمت ${(d.locationCounts[l.id] || 0).toLocaleString("fa-IR")} کارمند فعال حفظ می‌شود.`)) run({ op: "loc.edit", id: l.id, active: !l.active }); }}>{l.active ? "غیرفعال کردن" : "فعال کردن"}</Button>
              </div>
            ))}
          </Card>
          {dialog && <div className="org-dialog-bg" onClick={() => { setDialog(null); setErr(""); }}><div className="org-dialog" role="dialog" aria-modal="true" aria-label={dialog.kind === "add-child" ? "افزودن زیرواحد" : "ویرایش نام"} onClick={e => e.stopPropagation()}><h3>{dialog.kind === "add-child" ? "افزودن زیرواحد" : "ویرایش نام"}</h3><label>نام<input className="org-input" autoFocus value={dialog.name} onChange={e => setDialog({ ...dialog, name: e.target.value })} /></label>{err && <p role="alert" className="org-dialog-error">{err}</p>}<div className="org-dialog-actions"><Button variant="primary" disabled={!dialog.name.trim()} onClick={async () => { const body = dialog.kind === "add-child" ? { op: "unit.add", parentId: dialog.id, locationId: d.units.find(u => u.id === dialog.id)?.locationId, name: dialog.name } : { op: dialog.kind === "rename-unit" ? "unit.edit" : "loc.edit", id: dialog.id, name: dialog.name }; if (await run(body)) setDialog(null); }}>ذخیره</Button><Button onClick={() => { setDialog(null); setErr(""); }}>انصراف</Button></div></div></div>}
        </div>
      )}
    </PageFrame>
  );
}
