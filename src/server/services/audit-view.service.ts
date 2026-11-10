import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type { ListAuditLogsQuery } from "@/lib/validators/audit";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

export async function listAuditLogs(
  session: SessionContext,
  query: ListAuditLogsQuery
) {
  if (
    session.role !== "DEPARTMENT_ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Only administrators can view audit logs.");
  }

  const {
    page,
    pageSize,
    action,
    entityType,
    actorId,
    entityId,
    departmentId,
    fromDate,
    toDate,
  } = query;

  // Build where clause
  const where: Prisma.AuditLogWhereInput = {};

  if (session.role === "DEPARTMENT_ADMIN") {
    if (departmentId && departmentId !== session.departmentId) {
      assertDepartmentScope(session, departmentId);
    }
    // Scope Dept Admin strictly to results within their department
    where.departmentId = session.departmentId;
    where.entityType = "Result";
    // Decision D3: draft results/logs hidden from admins
    where.action = { not: "RESULT_DRAFT_SAVED" };
  } else {
    // SUPER_ADMIN
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (entityType) {
      where.entityType = entityType;
    }
  }

  if (action) {
    where.action = action;
  }

  if (actorId) {
    where.actorId = actorId;
  }

  if (entityId) {
    where.entityId = entityId;
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = new Date(fromDate);
    }
    if (toDate) {
      const end = new Date(toDate);
      if (toDate.length === 10) {
        // e.g. "2026-11-10", extend to end of day
        end.setHours(23, 59, 59, 999);
      }
      where.createdAt.lte = end;
    }
  }

  const [totalCount, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorId: true,
        actorRole: true,
        departmentId: true,
        beforeSummary: true,
        afterSummary: true,
        reason: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Clean summaries: strictly sanitize any secrets if present
  const sanitizedLogs = logs.map((log) => {
    const sanitize = (obj: unknown): unknown => {
      if (!obj || typeof obj !== "object") return obj;
      const clone = { ...(obj as Record<string, unknown>) };
      delete clone.passwordHash;
      delete clone.lockedUntil;
      delete clone.failedLoginCount;
      return clone;
    };

    return {
      ...log,
      beforeSummary: sanitize(log.beforeSummary),
      afterSummary: sanitize(log.afterSummary),
    };
  });

  return {
    items: sanitizedLogs,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}
