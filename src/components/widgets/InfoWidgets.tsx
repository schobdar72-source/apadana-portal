import { ClockWidget } from "./ClockWidget";
import { WeatherWidget } from "./WeatherWidget";

/** Clock (live, Jalali date) and weather cards. Shown in a row, not inside the header. */
export function InfoWidgets() {
  return (
    <div className="wd-row">
      <ClockWidget />
      <WeatherWidget />
    </div>
  );
}
