import { db } from "@/lib/db";

// A designation alone does not grant access after a role, membership or location changes.
export async function custodialWarehouses(employeeId: number): Promise<number[]> {
  const rows = await db.$queryRaw<{id:number}[]>`SELECT w."id" FROM "ItsmWarehouse" w JOIN "ItsmWarehouseCustodian" c ON c."warehouseId"=w."id" JOIN "Employee" e ON e."id"=c."employeeId" JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" WHERE c."employeeId"=${employeeId} AND e."active"=true AND e."locationId"=w."locationId" AND w."active"=true AND g."active"=true AND l."active"=true AND EXISTS (SELECT 1 FROM "ItsmGroupMembership" m WHERE m."employeeId"=e."id" AND m."groupId"=w."groupId") AND EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId"=e."id" AND r."role" IN ('technician','group_head'))`;
  return rows.map(row=>row.id);
}

export async function headedWarehouses(employeeId:number):Promise<number[]> {
  const rows=await db.$queryRaw<{id:number}[]>`SELECT w."id" FROM "ItsmWarehouse" w JOIN "ItsmGroup" g ON g."id"=w."groupId" JOIN "Location" l ON l."id"=w."locationId" JOIN "Employee" e ON e."id"=${employeeId} JOIN "ItsmGroupMembership" m ON m."groupId"=w."groupId" AND m."employeeId"=e."id" WHERE w."active"=true AND g."active"=true AND l."active"=true AND e."active"=true AND e."locationId"=w."locationId" AND EXISTS (SELECT 1 FROM "ItsmRoleGrant" r WHERE r."employeeId"=e."id" AND r."role"='group_head')`;
  return rows.map(row=>row.id);
}
