// SVG line icons for the sidebar. Use currentColor, so they follow the CSS color of the item.
export type NavIconName = "home" | "design" | "cafe" | "users" | "ticket" | "mail" | "chart" | "tv" | "brush" | "apps" | "wallet";

const paths: Record<NavIconName, JSX.Element> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  design: (
    <>
      <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z" />
      <path d="M13.5 6.5l3 3" />
    </>
  ),
  cafe: (
    <>
      <path d="M3 8h13v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V8z" />
      <path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M7 2.5c0 1.5 1.2 2 1.2 3.5M11.5 2.5c0 1.5 1.2 2 1.2 3.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 9V6h18v3a3 3 0 0 0 0 6v3H3v-3a3 3 0 0 0 0-6z" />
      <path d="M13 6v12" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h12v3" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 13.5h5" />
    </>
  ),
  tv: (
    <>
      <rect x="2.5" y="5" width="19" height="12.5" rx="2" />
      <path d="M8 21h8M12 17.5V21" />
    </>
  ),
  brush: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  apps: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name] ?? paths.apps}
    </svg>
  );
}
