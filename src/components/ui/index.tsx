import React from "react";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" | "default"; size?: "sm" | "md" };
export function Button({ variant = "default", size = "md", className = "", ...p }: BtnProps) {
  const v = variant === "default" ? "" : variant;
  return <button className={`ui-btn ${v} ${size === "sm" ? "sm" : ""} ${className}`} {...p} />;
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };
export function Input({ label, error, id, ...p }: InputProps) {
  const fid = id ?? `f-${label}`;
  return (
    <div>
      <label className="ui-label" htmlFor={fid}>{label}</label>
      <div className={`ui-field ${error ? "err" : ""}`}><input id={fid} aria-invalid={!!error} {...p} /></div>
      {error && <div className="ui-msg" role="alert">{error}</div>}
    </div>
  );
}

export function Card({ title, aside, children }: { title?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ui-card">
      {title && <h3>{title}{aside && <span style={{ fontSize: 12, color: "var(--c-accent-text)" }}>{aside}</span>}</h3>}
      {children}
    </section>
  );
}

export function Badge({ tone = "default", children }: { tone?: "default" | "ok" | "warn" | "info"; children: React.ReactNode }) {
  return <span className={`ui-badge ${tone === "default" ? "" : tone}`}>{children}</span>;
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="ui-kpi"><small>{label}</small><b>{value}</b></div>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return <div className="ui-note">{children}</div>;
}

export function DataTable({ columns, rows, onRowClick, activeRow }: { columns: string[]; rows: React.ReactNode[][]; onRowClick?: (i: number) => void; activeRow?: number }) {
  return (
    <table className="ui-table">
      <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className={`${onRowClick ? "is-clickable" : ""} ${activeRow === i ? "is-active" : ""}`} onClick={onRowClick ? () => onRowClick(i) : undefined}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
