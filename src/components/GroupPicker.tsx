"use client";
import { useEffect, useRef, useState } from "react";

// کشویی انتخاب گروه؛ همان الگوی منوی انتخاب شهر در اب‌وهوا
export function GroupPicker({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shown = options.filter((c) => c.includes(query.trim()));
  return (
    <div className="cafe-gp" ref={ref}>
      <button type="button" className="cafe-gp-btn" aria-haspopup="menu" aria-expanded={open} aria-label={label}
        onClick={() => { setOpen((o) => !o); setQuery(""); }}>
        {value || "انتخاب گروه"} <span className="wd-chev">▾</span>
      </button>
      {open && (
        <div className="wd-menu cafe-gp-menu" role="menu">
          {options.length > 6 && (
            <input className="wd-search" type="search" placeholder="جست‌وجوی گروه…" value={query} autoFocus
              onChange={(e) => setQuery(e.target.value)} aria-label="جست‌وجوی گروه" />
          )}
          {shown.map((c) => (
            <button key={c} type="button" role="menuitem" className={c === value ? "is-on" : ""}
              onClick={() => { onChange(c); setOpen(false); }}>{c}</button>
          ))}
          {shown.length === 0 && <div className="wd-empty">گروهی پیدا نشد</div>}
        </div>
      )}
    </div>
  );
}
