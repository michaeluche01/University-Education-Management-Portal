import { AppError } from "@/lib/errors";
import type {
  CreateFacultyInput,
  UpdateFacultyInput,
} from "@/lib/validators/structure";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

export async function listFaculties(session: SessionContext) {
  const where =
    session.role === "SUPER_ADMIN"
      ? {}
      : {
          departments: {
            some: { id: session.departmentId ?? "__none__" },
          },
        };

  return prisma.faculty.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { departments: true },
      },
      departments: {
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      },
    },
  });
}

export async function createFaculty(
  session: SessionContext,
  input: CreateFacultyInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only Super Admin can create faculties.");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.faculty.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description ?? null,
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "ENTITY_CREATED",
      entityType: "Faculty",
      entityId: created.id,
      afterSummary: {
        name: created.name,
        code: created.code,
        description: created.description,
      },
    });

    return created;
  });
}

export async function updateFaculty(
  session: SessionContext,
  id: string,
  input: UpdateFacultyInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only Super Admin can update faculties.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.faculty.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Faculty not found.");
    }

    const updated = await tx.faculty.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.description !== undefined
          ? { description: input.description ?? null }
          : {}),
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "ENTITY_UPDATED",
      entityType: "Faculty",
      entityId: updated.id,
      beforeSummary: {
        name: existing.name,
        code: existing.code,
        description: existing.description,
      },
      afterSummary: {
        name: updated.name,
        code: updated.code,
        description: updated.description,
      },
    });

    return updated;
  });
}

