import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type {
  CreateLecturerInput,
  ListLecturersQuery,
  UpdateLecturerInput,
} from "@/lib/validators/member";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export const SAFE_LECTURER_SELECT = {
  id: true,
  userId: true,
  staffId: true,
  departmentId: true,
  title: true,
  specialization: true,
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
  _count: { select: { assignments: true } },
} satisfies Prisma.LecturerSelect;

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

export async function listLecturers(
  session: SessionContext,
  query: ListLecturersQuery
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

  const andConditions: Prisma.LecturerWhereInput[] = [];
  if (effectiveDepartmentId) {
    andConditions.push({ departmentId: effectiveDepartmentId });
  }
  if (query.status) {
    andConditions.push({ user: { status: query.status } });
  }
  if (query.search) {
    const q = query.search.trim();
    if (q) {
      andConditions.push({
        OR: [
          { staffId: { contains: q, mode: "insensitive" } },
          { user: { fullName: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
  }

  const where: Prisma.LecturerWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [total, items] = await Promise.all([
    prisma.lecturer.count({ where }),
    prisma.lecturer.findMany({
      where,
      select: SAFE_LECTURER_SELECT,
      orderBy: [{ staffId: "asc" }],
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

export async function getLecturerById(
  session: SessionContext,
  lecturerProfileId: string
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const lecturer = await prisma.lecturer.findUnique({
    where: { id: lecturerProfileId },
    select: SAFE_LECTURER_SELECT,
  });

  if (!lecturer) {
    if (session.role === "DEPARTMENT_ADMIN") {
      throw new AppError(
        403,
        "FORBIDDEN_DEPARTMENT_SCOPE",
        "You do not have permission to access this lecturer."
      );
    }
    throw new AppError(404, "NOT_FOUND", "Lecturer not found.");
  }

  assertDepartmentScope(session, lecturer.departmentId);
  return lecturer;
}

export async function createLecturerProfile(
  session: SessionContext,
  input: CreateLecturerInput
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
        "Department is required when creating a lecturer."
      );
    }
    effectiveDepartmentId = input.departmentId;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const staffId = input.staffId.trim().toUpperCase();

  return prisma.$transaction(async (tx) => {
    const dept = await tx.department.findUnique({
      where: { id: effectiveDepartmentId },
      select: { id: true },
    });
    if (!dept) {
      throw new AppError(404, "NOT_FOUND", "Department not found.");
    }

    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone: input.phone ?? null,
        role: "LECTURER",
        status: "ACTIVE",
        lecturerProfile: {
          create: {
            staffId,
            departmentId: effectiveDepartmentId,
            title: input.title ?? null,
            specialization: input.specialization ?? null,
          },
        },
      },
      select: {
        id: true,
        lecturerProfile: { select: { id: true } },
      },
    });

    const lecturer = await tx.lecturer.findUniqueOrThrow({
      where: { id: createdUser.lecturerProfile!.id },
      select: SAFE_LECTURER_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_CREATED",
      entityType: "Lecturer",
      entityId: lecturer.id,
      departmentId: effectiveDepartmentId,
      afterSummary: {
        lecturerId: lecturer.id,
        userId: lecturer.userId,
        email: lecturer.user.email,
        fullName: lecturer.user.fullName,
        staffId: lecturer.staffId,
        departmentId: lecturer.departmentId,
        title: lecturer.title,
        specialization: lecturer.specialization,
      },
    });

    return lecturer;
  }, TX_OPTIONS);
}

export async function updateLecturerProfile(
  session: SessionContext,
  lecturerProfileId: string,
  input: UpdateLecturerInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.lecturer.findUnique({
      where: { id: lecturerProfileId },
      select: SAFE_LECTURER_SELECT,
    });

    if (!existing) {
      if (session.role === "DEPARTMENT_ADMIN") {
        throw new AppError(
          403,
          "FORBIDDEN_DEPARTMENT_SCOPE",
          "You do not have permission to update this lecturer."
        );
      }
      throw new AppError(404, "NOT_FOUND", "Lecturer not found.");
    }

    assertDepartmentScope(session, existing.departmentId);

    if (input.fullName !== undefined || input.phone !== undefined) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });
    }

    const updated = await tx.lecturer.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.specialization !== undefined
          ? { specialization: input.specialization }
          : {}),
      },
      select: SAFE_LECTURER_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_UPDATED",
      entityType: "Lecturer",
      entityId: updated.id,
      departmentId: updated.departmentId,
      beforeSummary: {
        fullName: existing.user.fullName,
        phone: existing.user.phone,
        title: existing.title,
        specialization: existing.specialization,
      },
      afterSummary: {
        fullName: updated.user.fullName,
        phone: updated.user.phone,
        title: updated.title,
        specialization: updated.specialization,
      },
    });

    return updated;
  }, TX_OPTIONS);
}
