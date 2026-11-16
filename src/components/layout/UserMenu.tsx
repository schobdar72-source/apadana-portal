"use client";

import { useEffect, useRef, useState } from "react";

type UserMenuProps = {
  name: string;
  role?: string;
  code?: string;
  photo?: string;
};

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8.5" r="4" fill="currentColor" />
      <path d="M4 20.5c1.2-3.6 4.2-5.5 8-5.5s6.8 1.9 8 5.5" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ d }: { d: string }) {
  return (
    <svg className="um-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserMenu({ name, role, code, photo }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="um" ref={ref}>
      <button type="button" ref={trigger} className="ui-me um-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="av">
          {photo ? <img src={photo} alt="" /> : <UserIcon />}
        </span>
        <span>
          <b>{name}</b>
          <small>{[role, code].filter(Boolean).join(" · ")}</small>
        </span>
        <svg className="um-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="um-menu">
          <a href="/profile"><MenuIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c1-4 4-6 7-6s6 2 7 6" />پروفایل من</a>
          <button type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}><MenuIcon d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h11" />خروج از حساب</button>
        </div>
      )}
    </div>
  );
}
