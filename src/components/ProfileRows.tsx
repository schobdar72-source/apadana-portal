"use client";
import { useState } from "react";
import { Card } from "@/components/ui";

type ProfileRow = { label: string; value: string; sensitive?: boolean; wide?: boolean; ltr?: boolean; status?: string };

export function ProfileRows({ title, rows, wide = false }: { title: string; rows: ProfileRow[]; wide?: boolean }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  return (
    <div className={wide ? "profile-card-wide" : undefined}><Card title={title}>
      <dl className="profile-fields">
        {rows.map(({ label: name, value, sensitive, wide, ltr, status }) => (
          <div className={`profile-field${wide ? " profile-field-wide" : ""}`} key={name}>
            <dt>{name}</dt>
            <dd className={value ? "" : "profile-empty"} dir={ltr && value ? "ltr" : "auto"}>
              {sensitive && value ? (
                <span className="profile-sensitive"><bdi>{revealed[name] ? value : "••••••••"}</bdi><button type="button" aria-label={`${revealed[name] ? "پنهان کردن" : "نمایش"} ${name}`} aria-pressed={!!revealed[name]} onClick={() => setRevealed((prev) => ({ ...prev, [name]: !prev[name] }))}>{revealed[name] ? "پنهان کردن" : "نمایش"}</button></span>
              ) : status && value ? <span className={`profile-status ${status === "active" ? "is-active" : "is-other"}`}>{value}</span> : value || "ثبت نشده"}
            </dd>
          </div>
        ))}
      </dl>
    </Card></div>
  );
}
