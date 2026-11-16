"use client";

const priorityNames: Record<string, string> = { critical: "بحرانی", high: "بالا", normal: "متوسط", low: "پایین" };

export function ItsmPriorityBadge({ priority, sla }: { priority?: string | null; sla?: string }) {
  if (!priority) return null;
  return <>
    <span className={`itsm-priority-badge ${priority}`}>{priorityNames[priority] || priority}</span>
    {sla === "breached" && <span className="itsm-sla-breached">خارج از مهلت</span>}
  </>;
}
