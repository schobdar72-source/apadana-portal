const P: Record<string, JSX.Element> = {
  cafe: <><path d="M3 8h13v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V8z" /><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9z"/><path d="M10 20h4"/></>,
  ticket: <><path d="M3 9V6h18v3a3 3 0 0 0 0 6v3H3v-3a3 3 0 0 0 0-6z" /><path d="M13 6v12" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  shield: <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />,
  truck: <><path d="M2 6h11v10H2zM13 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  tool: <path d="M14.5 6a4 4 0 0 0-5 5L3 17.5 6.5 21l6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2M3 10h18" /></>,
  gift: <><rect x="3" y="9" width="18" height="11" rx="1" /><path d="M12 9v11M3 13h18M12 9c-4 0-4-5 0-4s4 4 0 4z" /></>,
  phone: <><path d="M6.5 3.5 9 7.8 7.3 9.6a14 14 0 0 0 7.1 7.1l1.8-1.7 4.3 2.5-.6 2.3c-.2.8-1 1.3-1.8 1.2C9.7 19.8 4.2 14.3 3 5.9c-.1-.8.4-1.6 1.2-1.8z" /></>,
};
export const iconNames = Object.keys(P);
export function PortalIcon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] ?? P.doc}
    </svg>
  );
}
