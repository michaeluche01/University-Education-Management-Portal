import { AppError } from "@/lib/errors";
import type { CreateLevelInput } from "@/lib/validators/structure";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

export async function listLevels() {
  return prisma.academicLevel.findMany({
    orderBy: { levelNumber: "asc" },
    include: {
      _count: {
        select: { students: true, courses: true },
      },
    },
  });
}

export async function createLevel(
  session: SessionContext,
  input: CreateLevelInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can create academic levels."
    );
  }

  const derivedName = `${input.levelNumber} Level`;

  return prisma.$transaction(async (tx) => {
    const created = await tx.academicLevel.create({
      data: {
        levelNumber: input.levelNumber,
        name: derivedName,
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "ENTITY_CREATED",
      entityType: "AcademicLevel",
      entityId: created.id,
      afterSummary: {
        levelNumber: created.levelNumber,
        name: created.name,
      },
    });

    return created;
  });
}

