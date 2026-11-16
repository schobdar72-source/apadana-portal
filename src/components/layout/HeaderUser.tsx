"use client";
import { useMe, roleLabel } from "@/services/useMe";
import { UserMenu } from "./UserMenu";

export function HeaderUser() {
  const me = useMe();
  if (!me) return null;
  const fa = me.code.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
  return <UserMenu name={`${me.firstName} ${me.lastName}`} role={roleLabel(me.role)} code={fa} />;
}
