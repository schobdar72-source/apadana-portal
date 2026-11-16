import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/config/roles";

export const ITSM_ROLES = ["technician", "group_head", "it_manager", "delegate"] as const;
export type ItsmRole = (typeof ITSM_ROLES)[number];

export async function getItsmIdentity() {
  const employee = await currentUser();
  if (!employee) return null;
  const [grants, memberships] = await Promise.all([
    db.$queryRaw<{ role: string }[]>`SELECT "role" FROM "ItsmRoleGrant" WHERE "employeeId" = ${employee.id}`,
    db.$queryRaw<{ id: number; name: string }[]>`SELECT g."id", g."name" FROM "ItsmGroupMembership" m JOIN "ItsmGroup" g ON g."id" = m."groupId" WHERE m."employeeId" = ${employee.id} AND g."active" = true`,
  ]);
  return {
    employee: { id: employee.id, code: employee.code, firstName: employee.firstName, lastName: employee.lastName, unitId: employee.unitId, locationId: employee.locationId, positionTitle: employee.positionTitle },
    roles: grants.map((grant) => grant.role).filter((role): role is ItsmRole => ITSM_ROLES.includes(role as ItsmRole)),
    groups: memberships,
    canBootstrapManager: can(employee.role, "system.config"),
  };
}
