import type { LobbyWelcome } from "@/services/lobbyWelcome";

export function LobbyWelcomeText({ value }: { value: LobbyWelcome }) {
  return <div className="lb-welcome-copy" dir="rtl">
    <div className="lb-welcome-title"><span style={{color:value.titleColor}}>{value.title}</span>{" "}<span style={{color:value.highlightColor}}>{value.highlight}</span></div>
    {value.subtitle && <div className="lb-welcome-subtitle" style={{color:value.subtitleColor, borderColor:value.highlightColor}}>{value.subtitle}</div>}
    {value.greeting && <div className="lb-welcome-greeting" style={{color:value.greetingColor}}>{value.greeting}</div>}
  </div>;
}
