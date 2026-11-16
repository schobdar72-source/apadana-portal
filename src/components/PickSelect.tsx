"use client";
import { useEffect, useRef, useState } from "react";

export function PickSelect({ label, value, options, onChange, searchable }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; searchable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setTerm(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find(([v]) => v === value);
  const shown = searchable && term ? options.filter(([, l]) => l.includes(term)) : options;
  return (
    <div>
      <div className="ui-label">{label}</div>
      <div className="pk-wrap" ref={ref}>
        <button type="button" className="ui-field pk-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span style={{ opacity: cur ? 1 : 0.5 }}>{cur ? cur[1] : "انتخاب کنید"}</span>
          <svg className="pk-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {open && (
          <div className="wd-menu pk-menu" role="menu">
            {searchable && <input className="pk-search" autoFocus placeholder="جستجو در واحدها..." value={term} onChange={(e) => setTerm(e.target.value)} />}
            <button type="button" role="menuitem" onClick={() => { onChange(""); setOpen(false); setTerm(""); }}>—</button>
            {shown.map(([v, l]) => (
              <button key={v} type="button" role="menuitem" className={v === value ? "is-on" : ""} onClick={() => { onChange(v); setOpen(false); setTerm(""); }}>{l}</button>
            ))}
            {searchable && !shown.length && <div className="pk-empty">موردی پیدا نشد</div>}
          </div>
        )}
      </div>
    </div>
  );
}
