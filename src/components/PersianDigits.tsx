"use client";
import { useEffect } from "react";

const conv = (s: string) => s.replace(/[0-9]/g, (c) => "۰۱۲۳۴۵۶۷۸۹"[+c]);
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE"]);

function walk(root: Node) {
  if (root.nodeType === 3) {
    const t = root as Text;
    if (!SKIP.has(t.parentElement?.tagName ?? "") && !t.parentElement?.closest("[data-preserve-digits]") && /[0-9]/.test(t.data)) t.data = conv(t.data);
    return;
  }
  if (root.nodeType !== 1) return;
  const el = root as HTMLElement;
  if (SKIP.has(el.tagName) || el.closest("[data-preserve-digits]")) return;
  if (el.hasAttribute("placeholder")) el.setAttribute("placeholder", conv(el.getAttribute("placeholder")!));
  el.childNodes.forEach(walk);
}

/** همه‌ی ارقام لاتین نمایش‌داده‌شده در صفحه را به فارسی تبدیل می‌کند. */
export function PersianDigits() {
  useEffect(() => {
    walk(document.body);
    const mo = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") walk(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
