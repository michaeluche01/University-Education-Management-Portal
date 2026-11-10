import { AppError } from "@/lib/errors";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "@/lib/validators/structure";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

export async function listDepartments(
  session: SessionContext,
  filters?: { facultyId?: string }
) {
  const where =
    session.role === "SUPER_ADMIN"
      ? {
          ...(filters?.facultyId ? { facultyId: filters.facultyId } : {}),
        }
      : {
          id: session.departmentId ?? "__none__",
          ...(filters?.facultyId ? { facultyId: filters.facultyId } : {}),
        };

  return prisma.department.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      faculty: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: {
          programs: true,
          courses: true,
          students: true,
          lecturers: true,
        },
      },
    },
  });
}

export async function createDepartment(
  session: SessionContext,
  input: CreateDepartmentInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can create departments."
    );
  }

  return prisma.$transaction(async (tx) => {
    const faculty = await tx.faculty.findUnique({
      where: { id: input.facultyId },
      select: { id: true },
    });
    if (!faculty) {
      throw new AppError(404, "NOT_FOUND", "Target faculty not found.");
    }

    const created = await tx.department.create({
      data: {
        name: input.name,
        code: input.code,
        facultyId: input.facultyId,
      },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      departmentId: created.id,
      action: "ENTITY_CREATED",
      entityType: "Department",
      entityId: created.id,
      afterSummary: {
        name: created.name,
        code: created.code,
        facultyId: created.facultyId,
      },
    });

    return created;
  });
}

export async function updateDepartment(
  session: SessionContext,
  id: string,
  input: UpdateDepartmentInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can update departments."
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.department.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Department not found.");
    }

    if (input.facultyId && input.facultyId !== existing.facultyId) {
      const faculty = await tx.faculty.findUnique({
        where: { id: input.facultyId },
        select: { id: true },
      });
      if (!faculty) {
        throw new AppError(404, "NOT_FOUND", "Target faculty not found.");
      }
    }

    const updated = await tx.department.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.facultyId !== undefined
          ? { facultyId: input.facultyId }
          : {}),
      },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      departmentId: updated.id,
      action: "ENTITY_UPDATED",
      entityType: "Department",
      entityId: updated.id,
      beforeSummary: {
        name: existing.name,
        code: existing.code,
        facultyId: existing.facultyId,
      },
      afterSummary: {
        name: updated.name,
        code: updated.code,
        facultyId: updated.facultyId,
      },
    });

    return updated;
  });
}

