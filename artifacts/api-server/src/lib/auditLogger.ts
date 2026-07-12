import { db, auditLogsTable } from "@workspace/db";
import { logger } from "./logger";

export async function auditLog({
  userId,
  adminId,
  action,
  entity,
  entityId,
  details,
  ipAddress,
}: {
  userId?: number;
  adminId?: number;
  action: string;
  entity: string;
  entityId?: number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogsTable).values({
      userId: userId ?? null,
      adminId: adminId ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}
