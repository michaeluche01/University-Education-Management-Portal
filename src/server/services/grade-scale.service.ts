import { AppError } from "@/lib/errors";
import {
  validateAndDeriveGradeScale,
  type GradeScaleInputRow,
} from "@/lib/validators/structure";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

export async function listGradeScale() {
  return prisma.gradeScale.findMany({
    orderBy: { minScore: "desc" },
  });
}

export async function replaceGradeScale(
  session: SessionContext,
  inputRows: readonly GradeScaleInputRow[]
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can update the grading scale."
    );
  }

  const validation = validateAndDeriveGradeScale(inputRows);
  if (!validation.valid) {
    throw new AppError(400, "VALIDATION_ERROR", validation.errors[0], {
      details: validation.errors,
    });
  }

  return prisma.$transaction(async (tx) => {
    const beforeRows = await tx.gradeScale.findMany({
      orderBy: { minScore: "desc" },
      select: {
        grade: true,
        minScore: true,
        maxScore: true,
        gradePoint: true,
        remark: true,
      },
    });

    await tx.gradeScale.deleteMany({});

    await tx.gradeScale.createMany({
      data: validation.rows,
    });

    const afterRows = await tx.gradeScale.findMany({
      orderBy: { minScore: "desc" },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "GRADE_SCALE_UPDATED",
      entityType: "GradeScale",
      entityId: "GLOBAL_GRADE_SCALE",
      beforeSummary: { rows: beforeRows },
      afterSummary: {
        rows: validation.rows.map((r) => ({
          grade: r.grade,
          minScore: r.minScore,
          maxScore: r.maxScore,
          gradePoint: r.gradePoint,
          remark: r.remark,
        })),
      },
    });

    return afterRows;
  });
}

