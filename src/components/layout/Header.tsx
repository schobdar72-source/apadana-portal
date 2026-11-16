import { assets } from "@/config/assets.config";
import { InfoWidgets } from "../widgets/InfoWidgets";
import { HeaderUser } from "./HeaderUser";

type HeaderProps = {
  title: string;
  userName?: string;
  userRole?: string;
  /** Personnel code (کد پرسنلی), shown under the role */
  userCode?: string;
  /** Optional profile photo URL. When missing, a generic user icon is shown. */
  userPhoto?: string;
  /** Clock and weather. Shown unless explicitly false. */
  widgets?: boolean;
};

export function Header({ title, userName, userRole, userCode, userPhoto, widgets = true }: HeaderProps) {
  return (
    <header className="ui-hdr">
      <img src={assets.logo} alt="آپادانا کاوش" />
      <div className="ui-brand"><b>آپادانا کاوش ایرانیان</b><small>{title}</small></div>
      <div className="ui-sp" />
      {widgets && <InfoWidgets />}
      {userName ? null : <HeaderUser />}
    </header>
  );
}
