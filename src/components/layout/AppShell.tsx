import type { CSSProperties } from "react";
import { navGroups, type NavGroup } from "@/config/nav";
import { AccessGate } from "@/components/AccessGate";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

/**
 * Single layout for logged-in pages (home, login and the lobby TV stay outside it).
 * The menu comes from config/nav.ts unless a page passes its own groups.
 * Clock and weather are shown by default; pass widgets={false} to hide them.
 * style lets a customized page override tokens (e.g. --c-accent) on the shell.
 */
export function AppShell({ title, groups = navGroups, activeHref, widgets = true, style, children }: { title: string; groups?: NavGroup[]; activeHref: string; widgets?: boolean; style?: CSSProperties; children: React.ReactNode }) {
  return (
    <>
      <div className="ui-app" style={style}>
        <Sidebar groups={groups} activeHref={activeHref} />
        <div className="ui-col">
          <Header title={title} widgets={widgets} />
          <main><AccessGate href={activeHref}>{children}</AccessGate></main>
        </div>
      </div>
    </>
  );
}
