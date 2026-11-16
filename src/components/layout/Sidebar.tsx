"use client";
import { useEffect, useState } from "react";
import { NavIcon } from "./NavIcon";
import { PortalIcon } from "@/components/PortalIcon";
import { matchNav, type NavGroup } from "@/config/nav";
import { canSee } from "@/config/access";
import { useMe } from "@/services/useMe";

export type { NavGroup } from "@/config/nav";

// منوی آکاردئونی: در هر لحظه یک گروه باز است. گروه صفحه‌ی فعلی (تطابق دقیق یا پیشوند مسیر) از ابتدا باز می‌ماند.
export function Sidebar({ groups: allGroups, activeHref }: { groups: NavGroup[]; activeHref: string }) {
  const me = useMe();
  const groups = allGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !!me && canSee(me.role, i.href)) }))
    .filter((g) => g.items.length > 0);
  // هَش آدرس (مثل #tokens) برای تطابق لینک‌های بخشی لازم است؛ بعد از مانت خوانده می‌شود.
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const active = matchNav(groups, activeHref + hash);
  const [open, setOpen] = useState<string | null>(active.groupId);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { if (active.groupId) setOpen(active.groupId); }, [active.groupId]);
  return (
    <aside className={`sb${mobileOpen ? " sb-mobile-open" : ""}`} aria-label="منوی اصلی">
      <button type="button" className="sb-mobile-toggle" aria-expanded={mobileOpen} aria-controls="portal-sidebar-navigation" onClick={() => setMobileOpen(value => !value)}><span aria-hidden="true">☰</span><span>منوی پرتال</span><span aria-hidden="true">{mobileOpen ? "−" : "+"}</span></button>
      <div className="sb-nav" id="portal-sidebar-navigation">
      <a className="sb-top" href="/"><span className="ico"><NavIcon name="home" /></span>داشبورد</a>
      <div className="sb-group"><a className={`sb-item${activeHref === "/calendar" ? " open" : ""}`} href="/calendar" aria-current={activeHref === "/calendar" ? "page" : undefined} style={{ textDecoration: "none" }}><span className="ico"><PortalIcon name="calendar" size={18} /></span><span className="label">تقویم سازمانی</span></a></div>
      {groups.map((g) => {
        const isOpen = open === g.id;
        return (
          <div className="sb-group" key={g.id}>
            <button type="button" className={`sb-item ${isOpen ? "open" : ""}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.id)}>
              <span className="ico"><NavIcon name={g.icon} /></span><span className="label">{g.label}</span><span className="chev">‹</span>
            </button>
            {isOpen && (
              <ul className="sb-sub">
                {g.items.map((i) => {
                  const on = i.href === active.href;
                  return (
                    <li key={i.href + i.label}>
                      <a href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}><span className="chev">‹</span>{i.label}</a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      </div>
    </aside>
  );
}
