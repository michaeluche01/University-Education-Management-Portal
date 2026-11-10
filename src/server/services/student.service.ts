import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type {
  CreateStudentInput,
  ListStudentsQuery,
  UpdateStudentInput,
} from "@/lib/validators/member";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export const SAFE_STUDENT_SELECT = {
  id: true,
  userId: true,
  matricNumber: true,
  departmentId: true,
  programId: true,
  levelId: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  createdAt: true,
  updatedAt: true,
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
  _count: {
    select: {
      registrations: true,
      results: true,
    },
  },
} satisfies Prisma.StudentSelect;

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

export async function listStudents(
  session: SessionContext,
  query: ListStudentsQuery
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  if (query.departmentId && session.role === "DEPARTMENT_ADMIN") {
    assertDepartmentScope(session, query.departmentId);
  }

  const effectiveDepartmentId =
    session.role === "SUPER_ADMIN"
      ? query.departmentId
      : (session.departmentId ?? "__NO_DEPT__");

  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const andConditions: Prisma.StudentWhereInput[] = [];
  if (effectiveDepartmentId) {
    andConditions.push({ departmentId: effectiveDepartmentId });
  }
  if (query.programId) {
    andConditions.push({ programId: query.programId });
  }
  if (query.levelId) {
    andConditions.push({ levelId: query.levelId });
  }
  if (query.status) {
    andConditions.push({ user: { status: query.status } });
  }
  if (query.search) {
    const q = query.search.trim();
    if (q) {
      andConditions.push({
        OR: [
          { matricNumber: { contains: q, mode: "insensitive" } },
          { user: { fullName: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
  }

  const where: Prisma.StudentWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [total, items] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      select: SAFE_STUDENT_SELECT,
      orderBy: [{ matricNumber: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getStudentById(
  session: SessionContext,
  studentProfileId: string
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const student = await prisma.student.findUnique({
    where: { id: studentProfileId },
    select: SAFE_STUDENT_SELECT,
  });

  if (!student) {
    if (session.role === "DEPARTMENT_ADMIN") {
      throw new AppError(
        403,
        "FORBIDDEN_DEPARTMENT_SCOPE",
        "You do not have permission to access this student."
      );
    }
    throw new AppError(404, "NOT_FOUND", "Student not found.");
  }

  assertDepartmentScope(session, student.departmentId);
  return student;
}

export async function createStudentProfile(
  session: SessionContext,
  input: CreateStudentInput
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
        "Department is required when creating a student."
      );
    }
    effectiveDepartmentId = input.departmentId;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const matricNumber = input.matricNumber.trim().toUpperCase();

  return prisma.$transaction(async (tx) => {
    await validateStudentDepartmentProgramLevel(
      tx,
      effectiveDepartmentId,
      input.programId,
      input.levelId
    );

    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone: input.phone ?? null,
        role: "STUDENT",
        status: "ACTIVE",
        studentProfile: {
          create: {
            matricNumber,
            departmentId: effectiveDepartmentId,
            programId: input.programId,
            levelId: input.levelId,
            gender: input.gender ?? null,
            dateOfBirth: input.dateOfBirth ?? null,
            address: input.address ?? null,
          },
        },
      },
      select: {
        id: true,
        studentProfile: { select: { id: true } },
      },
    });

    const student = await tx.student.findUniqueOrThrow({
      where: { id: createdUser.studentProfile!.id },
      select: SAFE_STUDENT_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_CREATED",
      entityType: "Student",
      entityId: student.id,
      departmentId: effectiveDepartmentId,
      afterSummary: {
        studentId: student.id,
        userId: student.userId,
        email: student.user.email,
        fullName: student.user.fullName,
        matricNumber: student.matricNumber,
        departmentId: student.departmentId,
        programId: student.programId,
        levelId: student.levelId,
      },
    });

    return student;
  }, TX_OPTIONS);
}

export async function updateStudentProfile(
  session: SessionContext,
  studentProfileId: string,
  input: UpdateStudentInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.student.findUnique({
      where: { id: studentProfileId },
      select: SAFE_STUDENT_SELECT,
    });

    if (!existing) {
      if (session.role === "DEPARTMENT_ADMIN") {
        throw new AppError(
          403,
          "FORBIDDEN_DEPARTMENT_SCOPE",
          "You do not have permission to update this student."
        );
      }
      throw new AppError(404, "NOT_FOUND", "Student not found.");
    }

    assertDepartmentScope(session, existing.departmentId);

    const targetProgId = input.programId ?? existing.programId;
    const targetLevelId = input.levelId ?? existing.levelId;

    await validateStudentDepartmentProgramLevel(
      tx,
      existing.departmentId,
      targetProgId,
      targetLevelId
    );

    if (targetProgId !== existing.programId) {
      await assertCanMoveStudentDepartmentOrProgram(tx, existing.id);
    }

    if (input.fullName !== undefined || input.phone !== undefined) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });
    }

    const updated = await tx.student.update({
      where: { id: existing.id },
      data: {
        programId: targetProgId,
        levelId: targetLevelId,
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.dateOfBirth !== undefined
          ? { dateOfBirth: input.dateOfBirth }
          : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
      },
      select: SAFE_STUDENT_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_UPDATED",
      entityType: "Student",
      entityId: updated.id,
      departmentId: updated.departmentId,
      beforeSummary: {
        fullName: existing.user.fullName,
        phone: existing.user.phone,
        programId: existing.programId,
        levelId: existing.levelId,
        gender: existing.gender,
        dateOfBirth: existing.dateOfBirth,
        address: existing.address,
      },
      afterSummary: {
        fullName: updated.user.fullName,
        phone: updated.user.phone,
        programId: updated.programId,
        levelId: updated.levelId,
        gender: updated.gender,
        dateOfBirth: updated.dateOfBirth,
        address: updated.address,
      },
    });

    return updated;
  }, TX_OPTIONS);
}
