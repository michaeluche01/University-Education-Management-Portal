import { AppError } from "@/lib/errors";
import type {
  CreateProgramInput,
  UpdateProgramInput,
} from "@/lib/validators/structure";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export async function listPrograms(
  session: SessionContext,
  filters?: { departmentId?: string }
) {
  if (session.role === "DEPARTMENT_ADMIN" && filters?.departmentId) {
    assertDepartmentScope(session, filters.departmentId);
  }

  const where =
    session.role === "SUPER_ADMIN"
      ? {
          ...(filters?.departmentId
            ? { departmentId: filters.departmentId }
            : {}),
        }
      : session.role === "DEPARTMENT_ADMIN"
        ? {
            departmentId: session.departmentId ?? "__none__",
          }
        : {
            ...(filters?.departmentId
              ? { departmentId: filters.departmentId }
              : {}),
          };

  return prisma.program.findMany({
    where,
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    include: {
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          faculty: { select: { id: true, name: true, code: true } },
        },
      },
      _count: {
        select: { students: true, courses: true },
      },
    },
  });
}

export async function createProgram(
  session: SessionContext,
  input: CreateProgramInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  let effectiveDepartmentId: string;
  if (session.role === "DEPARTMENT_ADMIN") {
    if (input.departmentId) {
      assertDepartmentScope(session, input.departmentId);
    }
    if (!session.departmentId) {
      throw new AppError(
        403,
        "FORBIDDEN_DEPARTMENT_SCOPE",
        "No department assigned to session."
      );
    }
    effectiveDepartmentId = session.departmentId;
  } else {
    if (!input.departmentId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Department is required when creating a program."
      );
    }
    effectiveDepartmentId = input.departmentId;
  }

  return prisma.$transaction(async (tx) => {
    const department = await tx.department.findUnique({
      where: { id: effectiveDepartmentId },
      select: { id: true },
    });
    if (!department) {
      throw new AppError(404, "NOT_FOUND", "Department not found.");
    }

    const created = await tx.program.create({
      data: {
        name: input.name,
        code: input.code,
        durationYears: input.durationYears,
        departmentId: effectiveDepartmentId,
      },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      departmentId: created.departmentId,
      action: "ENTITY_CREATED",
      entityType: "Program",
      entityId: created.id,
      afterSummary: {
        name: created.name,
        code: created.code,
        durationYears: created.durationYears,
        departmentId: created.departmentId,
      },
    });

    return created;
  }, TX_OPTIONS);
}

export async function updateProgram(
  session: SessionContext,
  id: string,
  input: UpdateProgramInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.program.findUnique({ where: { id } });
    if (!existing) {
      if (session.role !== "SUPER_ADMIN") {
        throw new AppError(
          403,
          "FORBIDDEN_DEPARTMENT_SCOPE",
          "You do not have permission to access this program."
        );
      }
      throw new AppError(404, "NOT_FOUND", "Program not found.");
    }

    assertDepartmentScope(session, existing.departmentId);
    if (input.departmentId && input.departmentId !== existing.departmentId) {
      assertDepartmentScope(session, input.departmentId);
      const targetDept = await tx.department.findUnique({
        where: { id: input.departmentId },
        select: { id: true },
      });
      if (!targetDept) {
        throw new AppError(404, "NOT_FOUND", "Target department not found.");
      }
    }

    const updated = await tx.program.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.durationYears !== undefined
          ? { durationYears: input.durationYears }
          : {}),
        ...(input.departmentId !== undefined
          ? { departmentId: input.departmentId }
          : {}),
      },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      departmentId: updated.departmentId,
      action: "ENTITY_UPDATED",
      entityType: "Program",
      entityId: updated.id,
      beforeSummary: {
        name: existing.name,
        code: existing.code,
        durationYears: existing.durationYears,
        departmentId: existing.departmentId,
      },
      afterSummary: {
        name: updated.name,
        code: updated.code,
        durationYears: updated.durationYears,
        departmentId: updated.departmentId,
      },
    });

    return updated;
  }, TX_OPTIONS);
}

