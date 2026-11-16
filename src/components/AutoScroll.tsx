"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** اسکرول خودکار آرام: اگر محتوا بیشتر از جا باشد، بالا→پایین می‌رود، مکث می‌کند و برمی‌گردد. */
export function AutoScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0, pos = 0, dir = 1, wait = 120;
    const tick = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max > 2) {
        if (wait > 0) wait--;
        else {
          pos += dir * 0.4;
          if (pos >= max) { pos = max; dir = -1; wait = 120; }
          else if (pos <= 0) { pos = 0; dir = 1; wait = 120; }
          el.scrollTop = pos;
        }
      } else { pos = 0; el.scrollTop = 0; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="lb-body">{children}</div>;
}
