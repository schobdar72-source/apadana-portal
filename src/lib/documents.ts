import { db } from "@/lib/db";
import { can } from "@/config/roles";

export const categoryPrefix = "documents.category.";
export const documentPrefix = "documents.item.";
export const filePrefix = "documents.file.";
export const historyPrefix = "documents.history.";
export type Category = { id: string; name: string; active: boolean; everyone: boolean; unitIds: number[]; employeeIds: number[] };
export type DocumentItem = { id: string; categoryId: string; name: string; code: string; description: string; active: boolean; updatedAt: string; updatedBy: string; version?: number; validUntil?: string; reviewAt?: string; pdf?: { name: string; size: number }; original?: { name: string; size: number } };
export type DocumentViewer = { id: number; unitId: number | null; role: string };
export const canViewCategory = (category: Category, user: DocumentViewer) => can(user.role, "system.config") || (category.active && (category.everyone || (user.unitId !== null && category.unitIds.includes(user.unitId)) || category.employeeIds.includes(user.id)));
export async function readSettings<T>(prefix: string): Promise<T[]> {
  const records = await db.setting.findMany({ where: { key: { startsWith: prefix } }, select: { value: true } });
  return records.flatMap(record => { try { return [JSON.parse(record.value) as T]; } catch { return []; } });
}
