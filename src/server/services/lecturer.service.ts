import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

export async function assertCanMoveLecturerDepartment(
  tx: Prisma.TransactionClient,
  lecturerId: string
) {
  const assignmentCount = await tx.courseAssignment.count({
    where: { lecturerId },
  });
  if (assignmentCount > 0) {
    throw new AppError(
      409,
      "CONFLICT_IN_USE",
      "Cannot change department for a lecturer who has course assignments."
    );
  }
}

export async function assertCanConvertFromLecturer(
  tx: Prisma.TransactionClient,
  lecturerId: string,
  userId: string
) {
  const assignmentCount = await tx.courseAssignment.count({
    where: { lecturerId },
  });
  const resultCount = await tx.result.count({
    where: { enteredById: userId },
  });

  if (assignmentCount > 0 || resultCount > 0) {
    throw new AppError(
      409,
      "CONFLICT_IN_USE",
      "Cannot change role for a lecturer who has course assignments or entered results."
    );
  }
}

export async function listLecturersScoped(
  session: SessionContext,
  filters?: {
    departmentId?: string;
    search?: string;
  }
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const effectiveDepartmentId =
    session.role === "SUPER_ADMIN"
      ? filters?.departmentId
      : (session.departmentId ?? "__NO_DEPT__");

  if (filters?.departmentId && session.role === "DEPARTMENT_ADMIN") {
    assertDepartmentScope(session, filters.departmentId);
  }

  const where: Prisma.LecturerWhereInput = {};
  if (effectiveDepartmentId) {
    where.departmentId = effectiveDepartmentId;
  }
  if (filters?.search) {
    const q = filters.search.trim();
    if (q) {
      where.OR = [
        { staffId: { contains: q, mode: "insensitive" } },
        { user: { fullName: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }
  }

  return prisma.lecturer.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      department: { select: { id: true, code: true, name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { staffId: "asc" },
  });
}

