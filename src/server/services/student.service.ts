import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

export async function validateStudentDepartmentProgramLevel(
  tx: Prisma.TransactionClient,
  departmentId: string,
  programId: string,
  levelId: string
) {
  const department = await tx.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, code: true },
  });
  if (!department) {
    throw new AppError(404, "NOT_FOUND", "Department not found.");
  }

  const program = await tx.program.findUnique({
    where: { id: programId },
    select: { id: true, name: true, code: true, departmentId: true },
  });
  if (!program) {
    throw new AppError(404, "NOT_FOUND", "Program not found.");
  }
  if (program.departmentId !== department.id) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Selected program does not belong to the selected department."
    );
  }

  const level = await tx.academicLevel.findUnique({
    where: { id: levelId },
    select: { id: true, levelNumber: true, name: true },
  });
  if (!level) {
    throw new AppError(404, "NOT_FOUND", "Academic level not found.");
  }

  return { department, program, level };
}

export async function assertCanMoveStudentDepartmentOrProgram(
  tx: Prisma.TransactionClient,
  studentId: string
) {
  const regCount = await tx.courseRegistration.count({ where: { studentId } });
  const resCount = await tx.result.count({ where: { studentId } });

  if (regCount > 0 || resCount > 0) {
    throw new AppError(
      409,
      "CONFLICT_IN_USE",
      "Cannot change department or program for a student who already has course registrations or results."
    );
  }
}

export async function listStudentsScoped(
  session: SessionContext,
  filters?: {
    departmentId?: string;
    programId?: string;
    levelId?: string;
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

  const where: Prisma.StudentWhereInput = {};
  if (effectiveDepartmentId) {
    where.departmentId = effectiveDepartmentId;
  }
  if (filters?.programId) {
    where.programId = filters.programId;
  }
  if (filters?.levelId) {
    where.levelId = filters.levelId;
  }
  if (filters?.search) {
    const q = filters.search.trim();
    if (q) {
      where.OR = [
        { matricNumber: { contains: q, mode: "insensitive" } },
        { user: { fullName: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }
  }

  return prisma.student.findMany({
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
      program: { select: { id: true, code: true, name: true } },
      level: { select: { id: true, levelNumber: true, name: true } },
    },
    orderBy: { matricNumber: "asc" },
  });
}

