"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageFrame } from "@/components/PageFrame";
import { Button, Card, Note } from "@/components/ui";
import { buildTree, flatten, type ONode, type OUnit } from "@/lib/orgTree";
import { exportCsv, exportXlsx } from "@/lib/exporter";
import { exportPdf, exportPng, exportSvg } from "@/lib/orgExport";
import "@/styles/org-chart.css";

type Unit = OUnit & { headId: number | null; locationId: number | null };
type Person = { id: number; code: string; name: string; unitId: number; title: string | null; rank: number | null; locationId: number | null };
type Data = { units: Unit[]; counts: Record<number, number>; people: Person[]; locations: { id: number; name: string; active: boolean }[]; activeEmployees: number; unassignedByLocation: Record<string, number> };
type Point = { n: ONode; x: number; y: number };
const W = 220, H = 112, GX = 22, GY = 54, PAD = 24;
const fa = (n: number) => n.toLocaleString("fa-IR");
const clip = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;

function layout(roots: ONode[]) {
  const pts: Point[] = [], edges: [Point, Point][] = [];
  const width = (n: ONode): number => Math.max(W, n.children.reduce((s, c) => s + width(c) + GX, -GX));
  const place = (n: ONode, left: number): Point => {
    const w = width(n); const children: Point[] = []; let x = left;
    for (const child of n.children) { children.push(place(child, x)); x += width(child) + GX; }
    const p = { n, x: children.length ? (children[0].x + children[children.length - 1].x) / 2 : left + (w - W) / 2, y: (n.depth - 1) * (H + GY) };
    pts.push(p); for (const child of children) edges.push([p, child]); return p;
  };
  let cursor = 0; for (const root of roots) { place(root, cursor); cursor += width(root) + GX; }
  const maxX = Math.max(0, ...pts.map(p => p.x + W)), maxY = Math.max(0, ...pts.map(p => p.y + H));
  const mirror = (p: Point) => ({ ...p, x: maxX - p.x - W + PAD, y: p.y + PAD });
  return { pts: pts.map(mirror), edges: edges.map(([a, b]) => [mirror(a), mirror(b)] as [Point, Point]), w: maxX + PAD * 2, h: maxY + PAD * 2 };
}

function TreeList({ nodes, expanded, toggle, select, selected, people }: { nodes: ONode[]; expanded: Set<number>; toggle: (id: number) => void; select: (id: number) => void; selected: number | null; people: Person[] }) {
  return <>{nodes.map(n => {
    const isOpen = expanded.has(n.id), direct = people.filter(p => p.unitId === n.id);
    return <div key={n.id} className="oc-list-branch">
      <div className={`oc-list-row${selected === n.id ? " is-selected" : ""}${n.active ? "" : " is-inactive"}`}>
        <button className="oc-list-toggle" type="button" aria-label={`${isOpen ? "بستن" : "باز کردن"} ${n.name}`} aria-expanded={isOpen} onClick={() => toggle(n.id)}>{isOpen ? "−" : "+"}</button>
        <button className="oc-list-name" type="button" onClick={() => select(n.id)}>{n.name}{!n.active && <small>غیرفعال</small>}</button>
        <span>{fa(n.direct)} مستقیم · {fa(n.total)} کل</span>
      </div>
      {isOpen && <div className="oc-list-children">
        {direct.length > 0 && <div className="oc-list-people">{direct.map(p => <Link key={p.id} href={`/hr/employees?open=${p.id}`}>{p.name}<small>{p.title || "عنوان ثبت نشده"}</small></Link>)}</div>}
        {!direct.length && !n.children.length && <p className="oc-muted">کارمند فعالی در این واحد ثبت نشده است.</p>}
        <TreeList nodes={n.children} expanded={expanded} toggle={toggle} select={select} selected={selected} people={people}/>
      </div>}
    </div>;
  })}</>;
}

export default function OrgChartPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"chart" | "list">("chart");
  const [root, setRoot] = useState("");
  const [loc, setLoc] = useState("");
  const [maxDepth, setMaxDepth] = useState(8);
  const [hideOff, setHideOff] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { const target = event.target as Node; if (!searchRef.current?.contains(target)) setShowSearch(false); if (!exportRef.current?.contains(target)) setExportOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setShowSearch(false); setExportOpen(false); } };
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => { if (selected === null || view !== "chart") return; const node = svgRef.current?.querySelector(`[data-unit-id="${selected}"]`); node?.scrollIntoView({ block: "nearest", inline: "center" }); }, [selected, view]);

  useEffect(() => { let live = true; fetch("/api/hr/org").then(async r => { if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "دسترسی به چارت برای این حساب فعال نیست." : "دریافت چارت ممکن نشد."); return r.json(); }).then(data => { if (live) setD(data); }).catch(e => { if (live) setError(e.message || "ارتباط با سرور برقرار نشد."); }); return () => { live = false; }; }, []);

  const scope = useMemo(() => {
    if (!d) return { units: [] as Unit[], counts: {} as Record<number, number>, people: [] as Person[] };
    if (!loc) return { units: d.units, counts: d.counts, people: d.people };
    const people = d.people.filter(p => loc === "none" ? p.locationId === null : p.locationId === Number(loc));
    const counts: Record<number, number> = {}; for (const p of people) counts[p.unitId] = (counts[p.unitId] ?? 0) + 1;
    const keep = new Set<number>();
    for (const u of d.units) if (loc === "none" ? u.locationId === null : u.locationId === Number(loc)) keep.add(u.id);
    for (const uid of [...keep, ...people.map(p => p.unitId)]) { let cur: Unit | undefined = d.units.find(u => u.id === uid); const seen = new Set<number>(); while (cur && !seen.has(cur.id)) { keep.add(cur.id); seen.add(cur.id); cur = d.units.find(u => u.id === cur!.parentId); } }
    return { units: d.units.filter(u => keep.has(u.id)), counts, people };
  }, [d, loc]);
  const fullTree = useMemo(() => buildTree(scope.units, scope.counts, { rootId: root ? Number(root) : null, hideInactive: hideOff }), [scope, root, hideOff]);
  const fullNodes = useMemo(() => flatten(fullTree), [fullTree]);
  const fullById = useMemo(() => new Map(fullNodes.map(n => [n.id, n])), [fullNodes]);
  const tree = useMemo(() => buildTree(scope.units, scope.counts, { rootId: root ? Number(root) : null, maxDepth, hideInactive: hideOff }), [scope, root, maxDepth, hideOff]);
  const shownNodes = useMemo(() => flatten(tree), [tree]);
  const chartTree = useMemo(() => { const prune = (n: ONode): ONode => ({ ...n, children: collapsed.has(n.id) ? [] : n.children.map(prune) }); return tree.map(prune); }, [tree, collapsed]);
  const lay = useMemo(() => layout(chartTree), [chartTree]);
  const totalPeople = fullTree.reduce((n, u) => n + u.total, 0);
  const displayedPeople = shownNodes.reduce((n, u) => n + u.direct, 0);
  const missing = d ? (loc ? d.unassignedByLocation[loc] ?? 0 : Object.values(d.unassignedByLocation).reduce((a, n) => a + n, 0)) : 0;
  const selectedUnit = d?.units.find(u => u.id === selected);
  const selectedNode = selected === null ? undefined : fullById.get(selected);
  const selectedPeople = scope.people.filter(p => p.unitId === selected);
  const headName = (id: number) => { const unit = d?.units.find(u => u.id === id); return unit?.headId ? scope.people.find(p => p.id === unit.headId)?.name || "مسئول در این محدوده نیست" : "مسئول تعیین نشده"; };
  const locationName = (id: number | null | undefined) => id ? d?.locations.find(l => l.id === id)?.name || "محل نامشخص" : "محل تعیین نشده";
  const pathOf = (id: number) => { const result: string[] = [], seen = new Set<number>(); let u = d?.units.find(x => x.id === id); while (u && !seen.has(u.id)) { result.unshift(u.name); seen.add(u.id); u = d?.units.find(x => x.id === u!.parentId); } return result; };
  const norm = (s: string) => s.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  const searchResults = search.trim() ? scope.units.filter(u => norm(pathOf(u.id).join(" ")).includes(norm(search))).slice(0, 30) : [];
  const select = (id: number) => { setSelected(id); setShowSearch(false); const parents = new Set<number>(); let u = d?.units.find(x => x.id === id); while (u?.parentId && !parents.has(u.parentId)) { parents.add(u.parentId); u = d?.units.find(x => x.id === u!.parentId); } setCollapsed(s => new Set([...s].filter(x => !parents.has(x)))); setExpanded(s => new Set([...s, ...parents, id])); };
  const chooseSearch = (id: number) => { const inside = fullById.has(id); if (!inside) { setRoot(""); if (hideOff) setHideOff(false); } setMaxDepth(8); select(id); setSearch(""); };
  const fit = () => { if (!viewportRef.current || !lay.w) return; setZoom(Math.min(1, Math.max(.4, (viewportRef.current.clientWidth - 24) / lay.w))); };
  const rows = () => fullNodes.map(n => { const path = pathOf(n.id); const unit = d?.units.find(u => u.id === n.id); return [...Array.from({ length: 8 }, (_, i) => path[i] || ""), locationName(unit?.locationId), headName(n.id), n.direct, n.total, n.active ? "فعال" : "غیرفعال"]; });
  const headers = [...Array.from({ length: 8 }, (_, i) => `سطح ${fa(i + 1)}`), "محل خدمت", "مسئول", "تعداد مستقیم", "تعداد کل زیرمجموعه", "وضعیت"];
  const doExport = (kind: string) => { setExportOpen(false); if (kind === "xlsx") exportXlsx("org-structure", headers, rows()); else if (kind === "csv") exportCsv("org-structure", headers, rows()); else if (kind === "print") window.print(); else if (svgRef.current) { if (kind === "svg") exportSvg(svgRef.current, "org-structure"); if (kind === "png") void exportPng(svgRef.current, "org-structure"); if (kind === "pdf") void exportPdf(svgRef.current, "org-structure"); } };

  return <PageFrame id="hr" title="چارت سازمانی" activeHref="/hr/org/chart">
    {error && <Note>{error}</Note>}
    {!d && !error && <Note>در حال دریافت ساختار سازمانی…</Note>}
    {d && <div className="oc-page">
      <div className="oc-intro"><div><h1>چارت سازمانی</h1><p>ساختار واحدها و همکاران را بر اساس محل خدمت بررسی کنید.</p></div><Link href="/hr/org">مدیریت ساختار سازمانی ←</Link></div>
      <div className="oc-summary"><div><span>واحدهای محدوده انتخابی</span><strong>{fa(fullNodes.length)}</strong><small>{fa(shownNodes.length)} واحد تا سطح انتخاب‌شده</small></div><div><span>کارکنان واحدهای انتخابی</span><strong>{fa(totalPeople)}</strong><small>{fa(displayedPeople)} نفر در سطح‌های نمایش‌داده‌شده</small></div><div><span>کارکنان فعال بدون واحد</span><strong>{fa(missing)}</strong><small>در محل انتخاب‌شده، خارج از چارت</small><Link href={loc ? `/hr/employees?issue=unit&location=${loc === "none" ? "missing" : loc}` : "/hr/employees?issue=unit"}>مشاهده پرونده‌ها</Link></div></div>
      <Card>
        <div className="oc-section-head"><div><h2>نمای ساختار سازمان</h2><p>برای مشاهده جزئیات، یک واحد را انتخاب کنید.</p></div><div className="oc-view" role="group" aria-label="نوع نمایش"><button type="button" aria-pressed={view === "chart"} className={view === "chart" ? "is-active" : ""} onClick={() => setView("chart")}>نمودار</button><button type="button" aria-pressed={view === "list"} className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>فهرست</button></div></div>
        <div className="oc-filters">
          <label>محل خدمت<select value={loc} onChange={e => { setLoc(e.target.value); setRoot(""); setSelected(null); setCollapsed(new Set()); setSearch(""); }}><option value="">همه محل‌های خدمت</option><option value="none">محل تعیین نشده</option>{d.locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.active ? "" : " (غیرفعال)"}</option>)}</select></label>
          <label>شاخه سازمانی<select value={root} onChange={e => { setRoot(e.target.value); setSelected(null); setCollapsed(new Set()); }}><option value="">همه واحدهای محدوده</option>{scope.units.filter(u => !hideOff || u.active).map(u => <option key={u.id} value={u.id}>{pathOf(u.id).join(" › ")} · {locationName(u.locationId)}</option>)}</select></label>
          <label>عمق نمایش<select value={maxDepth} onChange={e => setMaxDepth(Number(e.target.value))}>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>تا سطح {fa(i + 1)}</option>)}</select></label>
          <label className="oc-checkbox"><input type="checkbox" checked={hideOff} onChange={e => { setHideOff(e.target.checked); if (e.target.checked && root && !scope.units.find(u => u.id === Number(root))?.active) setRoot(""); setSelected(null); }}/><span>پنهان کردن واحدهای غیرفعال</span></label>
          <div className="oc-search" ref={searchRef}><label htmlFor="oc-search-input">جست‌وجوی واحد</label><input id="oc-search-input" value={search} placeholder="نام واحد یا مسیر آن" autoComplete="off" onChange={e => { setSearch(e.target.value); setShowSearch(true); }} onFocus={() => setShowSearch(true)} onKeyDown={e => { if (e.key === "Escape") setShowSearch(false); if (e.key === "Enter" && searchResults.length) { e.preventDefault(); chooseSearch(searchResults[0].id); } }}/>{showSearch && search.trim() && <div className="oc-search-results">{searchResults.length ? searchResults.map(u => <button type="button" key={u.id} onClick={() => chooseSearch(u.id)}><strong>{u.name}</strong><small>{pathOf(u.id).join(" › ")} · {locationName(u.locationId)}</small></button>) : <span>واحدی پیدا نشد.</span>}</div>}</div>
        </div>
        <div className="oc-toolbar"><div className="oc-toolbar-group">{view === "chart" ? <><Button size="sm" onClick={() => setZoom(z => Math.max(.4, z - .1))} aria-label="کوچک‌نمایی">−</Button><span className="oc-zoom">{fa(Math.round(zoom * 100))}٪</span><Button size="sm" onClick={() => setZoom(z => Math.min(2, z + .1))} aria-label="بزرگ‌نمایی">+</Button><Button size="sm" onClick={fit}>متناسب با صفحه</Button><Button size="sm" onClick={() => setCollapsed(new Set())}>باز کردن شاخه‌ها</Button><Button size="sm" onClick={() => setCollapsed(new Set(shownNodes.filter(n => n.children.length).map(n => n.id)))}>بستن شاخه‌ها</Button></> : <><Button size="sm" onClick={() => setExpanded(new Set(shownNodes.map(n => n.id)))}>باز کردن همه</Button><Button size="sm" onClick={() => setExpanded(new Set())}>بستن همه</Button></>}</div><div className="oc-export" ref={exportRef}><Button size="sm" aria-expanded={exportOpen} onClick={() => setExportOpen(v => !v)}>خروجی و چاپ ▾</Button>{exportOpen && <div className="oc-export-menu">{[["xlsx", "اکسل (همه سطح‌ها)"], ["csv", "CSV (همه سطح‌ها)"], ...(view === "chart" ? [["png", "تصویر PNG"], ["pdf", "PDF"], ["svg", "SVG"]] : []), ["print", "چاپ"]].map(([v, title]) => <button type="button" key={v} onClick={() => doExport(v)}>{title}</button>)}</div>}</div></div>
        {fullNodes.length === 0 ? <div className="oc-empty">واحدی در محدوده انتخاب‌شده وجود ندارد. فیلترها را تغییر دهید.</div> : view === "chart" ? <>
          <p className="oc-canvas-help">برای جابه‌جایی، نمودار را بکشید یا از نوار پیمایش استفاده کنید. عدد کل، همه زیرواحدها را در محدوده فیلتر در نظر می‌گیرد.</p>
          <div className="oc-canvas" ref={viewportRef} onPointerDown={e => { if (e.pointerType !== "mouse" || (e.target as Element).closest("[data-node-control]")) return; drag.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { const p = drag.current; if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.abs(dx) + Math.abs(dy) > 4) p.moved = true; if (p.moved) { e.currentTarget.scrollLeft = p.left - dx; e.currentTarget.scrollTop = p.top - dy; } }} onPointerUp={() => { suppressClick.current = !!drag.current?.moved; drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <svg ref={svgRef} width={lay.w * zoom} height={lay.h * zoom} viewBox={`0 0 ${lay.w} ${lay.h}`} direction="rtl" fontFamily="Tahoma, Arial, sans-serif" role="group" aria-label="نمودار واحدهای سازمانی"><rect width={lay.w} height={lay.h} fill="#e6e8e4"/>{lay.edges.map(([a, b], i) => { const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y, mid = (y1 + y2) / 2; return <path key={i} d={`M${x1} ${y1} V${mid} H${x2} V${y2}`} fill="none" stroke="#a0a8a3" strokeWidth={2}/>; })}{lay.pts.map(({ n, x, y }) => { const hasKids = n.children.length > 0 || collapsed.has(n.id) && (shownNodes.find(k => k.id === n.id)?.children.length ?? 0) > 0; return <g key={n.id} transform={`translate(${x} ${y})`} opacity={n.active ? 1 : .65}><g data-unit-id={n.id} data-node-control role="button" tabIndex={0} aria-label={`${n.name}، ${fa(n.direct)} نفر مستقیم، ${fa(n.total)} نفر کل`} onClick={() => { if (!suppressClick.current) select(n.id); suppressClick.current = false; }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n.id); } }} className="oc-svg-node"><rect width={W} height={H} rx={12} fill={selected === n.id ? "#f2e8cc" : "#f5f5f1"} stroke={selected === n.id ? "#b8891d" : "#c2c9c2"} strokeWidth={selected === n.id ? 2 : 1}/><rect width={W} height={5} rx={2} fill="#d4a127"/><text x={W / 2} y={29} textAnchor="middle" fontSize={14} fontWeight="700" fill="#303738">{clip(n.name, 25)}<title>{n.name}</title></text><text x={W / 2} y={53} textAnchor="middle" fontSize={11} fill="#626b69">{fa(n.direct)} مستقیم · {fa(n.total)} کل{n.active ? "" : " · غیرفعال"}</text><text x={W / 2} y={76} textAnchor="middle" fontSize={11} fill="#555d5d">{clip(headName(n.id), 28)}<title>{headName(n.id)}</title></text><text x={W / 2} y={97} textAnchor="middle" fontSize={10} fill="#8b6b23">{clip(locationName(d.units.find(u => u.id === n.id)?.locationId), 30)}</text></g>{hasKids && <g data-node-control role="button" tabIndex={0} aria-label={`${collapsed.has(n.id) ? "باز کردن" : "بستن"} زیرواحدهای ${n.name}`} onClick={() => setCollapsed(s => { const next = new Set(s); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next; })} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed(s => { const next = new Set(s); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next; }); } }} className="oc-svg-toggle"><rect x={W / 2 - 13} y={H - 12} width={26} height={24} rx={7} fill="#f0dfab" stroke="#c9a44e"/><text x={W / 2} y={H + 5} textAnchor="middle" fontSize={16} fill="#5f4b1f">{collapsed.has(n.id) ? "+" : "−"}</text></g>}</g>; })}</svg>
          </div></> : <div className="oc-list"><TreeList nodes={tree} expanded={expanded} toggle={id => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} select={select} selected={selected} people={scope.people}/></div>}
        {selectedUnit && selectedNode && <div className="oc-detail"><div className="oc-detail-head"><div><h3>{selectedUnit.name}</h3><p>{pathOf(selectedUnit.id).join(" › ")} · {locationName(selectedUnit.locationId)}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="بستن جزئیات">×</button></div><div className="oc-detail-meta"><span>مسئول: <b>{headName(selectedUnit.id)}</b></span><span>مستقیم: <b>{fa(selectedNode.direct)} نفر</b></span><span>کل زیرمجموعه: <b>{fa(selectedNode.total)} نفر</b></span></div><h4>کارکنان مستقیم این واحد</h4>{selectedPeople.length ? <div className="oc-people">{selectedPeople.map(p => <Link key={p.id} href={`/hr/employees?open=${p.id}`}><strong>{p.name}</strong><small>{p.title || "عنوان ثبت نشده"} · کد {p.code}</small></Link>)}</div> : <p className="oc-muted">در محدوده انتخابی کارمند فعالی برای این واحد ثبت نشده است.</p>}</div>}
      </Card>
    </div>}
  </PageFrame>;
}
