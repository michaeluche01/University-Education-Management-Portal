import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction, Role } from "@/generated/prisma/enums";

export interface WriteAuditInput {
  actorId: string;
  actorRole: Role;
  departmentId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeSummary?: Prisma.InputJsonValue;
  afterSummary?: Prisma.InputJsonValue;
  reason?: string | null;
}

/**
 * Append-only audit log writer (Decision D11).
 * Designed to be called inside interactive Prisma transactions (`tx`).
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: WriteAuditInput
) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      departmentId: input.departmentId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeSummary: input.beforeSummary,
      afterSummary: input.afterSummary,
      reason: input.reason ?? null,
    },
  });
}

