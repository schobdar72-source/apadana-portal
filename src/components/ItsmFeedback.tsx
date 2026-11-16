"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// لایه بازخورد ماژول تیکتینگ: Toast لحظه‌ای + مودال تأیید + مودال ورودی متن.
// الگو برگرفته از صفحه مستندات (documents.tsx) با API مناسب ITSM.
//
// - itsmNotify(text, kind?)   → نمایش Toast پنج‌ثانیه‌ای (در هر نقطه قابل فراخوانی است)
// - useItsmDialogs()          → { ask, askText, dialogs }؛ JSX خروجی «dialogs» را در صفحه رندر کنید
// - <ItsmToasts/>             → یک‌بار در صفحه قرار می‌گیرد و پشته Toast را نمایش می‌دهد

type ToastKind = "ok" | "err";
type ToastItem = { id: number; text: string; kind: ToastKind };
type TextRequest = { title: string; placeholder?: string; help?: string; minLength?: number; minWords?: number; confirmLabel?: string };
type ConfirmState = { text: string; confirmLabel?: string; resolve: (ok: boolean) => void };
type TextState = TextRequest & { resolve: (value: string | null) => void };

const listeners = new Set<(toast: ToastItem) => void>();
let toastSeq = 0;
export function itsmNotify(text: string, kind: ToastKind = "ok") { listeners.forEach((listener) => listener({ id: ++toastSeq, text, kind })); }

export function ItsmToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => {
    const listener = (toast: ToastItem) => {
      setToasts((list) => [...list, toast]);
      window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== toast.id)), 5000);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  if (!toasts.length) return null;
  return <div className="itsm-toasts" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`itsm-toast ${toast.kind}`}>{toast.text}</div>)}</div>;
}

export function useItsmDialogs() {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [textRequest, setTextRequest] = useState<TextState | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textError, setTextError] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const ask = (text: string, confirmLabel?: string) => new Promise<boolean>((resolve) => { if (alive.current) setConfirm({ text, confirmLabel, resolve }); else resolve(false); });
  const askText = (request: TextRequest) => new Promise<string | null>((resolve) => { if (!alive.current) { resolve(null); return; } setTextValue(""); setTextError(""); setTextRequest({ ...request, resolve }); });

  const settleConfirm = (ok: boolean) => { confirm?.resolve(ok); setConfirm(null); };
  const settleText = (submit: boolean) => {
    if (!textRequest) return;
    if (submit) {
      const value = textValue.trim();
      const words = value.split(/\s+/).filter(Boolean);
      if (textRequest.minLength && value.length < textRequest.minLength) { setTextError(`حداقل ${textRequest.minLength.toLocaleString("fa-IR")} نویسه بنویسید.`); return; }
      if (textRequest.minWords && words.length < textRequest.minWords) { setTextError(`کمی کامل‌تر بنویسید (حداقل ${textRequest.minWords.toLocaleString("fa-IR")} کلمه).`); return; }
      textRequest.resolve(value);
    } else textRequest.resolve(null);
    setTextRequest(null);
  };

  useEffect(() => {
    if (!confirm && !textRequest) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { settleConfirm(false); settleText(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  let dialogs: ReactNode = null;
  if (confirm) dialogs = <div className="itsm-modal-bg" onClick={() => settleConfirm(false)}>
    <div className="itsm-modal" role="alertdialog" aria-modal="true" aria-label={confirm.text} onClick={(event) => event.stopPropagation()}>
      <p>{confirm.text}</p>
      <div className="itsm-modal-actions">
        <button type="button" className="itsm-primary" autoFocus onClick={() => settleConfirm(true)}>{confirm.confirmLabel || "تأیید"}</button>
        <button type="button" className="itsm-secondary" onClick={() => settleConfirm(false)}>انصراف</button>
      </div>
    </div>
  </div>;
  else if (textRequest) dialogs = <div className="itsm-modal-bg" onClick={() => settleText(false)}>
    <form className="itsm-modal" onSubmit={(event) => { event.preventDefault(); settleText(true); }} onClick={(event) => event.stopPropagation()}>
      <p><strong>{textRequest.title}</strong></p>
      <textarea autoFocus rows={4} maxLength={500} value={textValue} placeholder={textRequest.placeholder} onChange={(event) => { setTextValue(event.target.value); setTextError(""); }}/>
      {textRequest.help && <small>{textRequest.help}</small>}
      {textError && <p className="itsm-modal-error" role="alert">{textError}</p>}
      <div className="itsm-modal-actions">
        <button type="submit" className="itsm-primary">{textRequest.confirmLabel || "ثبت"}</button>
        <button type="button" className="itsm-secondary" onClick={() => settleText(false)}>انصراف</button>
      </div>
    </form>
  </div>;

  return { ask, askText, dialogs };
}
