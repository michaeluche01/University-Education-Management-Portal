import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type {
  CreateUserInput,
  ListUsersQuery,
  ResetUserPasswordInput,
  UpdateUserInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from "@/lib/validators/user";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";
import {
  assertCanConvertFromLecturer,
  assertCanMoveLecturerDepartment,
} from "@/server/services/lecturer.service";
import {
  assertCanMoveStudentDepartmentOrProgram,
  validateStudentDepartmentProgramLevel,
} from "@/server/services/student.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  studentProfile: {
    select: {
      id: true,
      matricNumber: true,
      departmentId: true,
      programId: true,
      levelId: true,
      department: { select: { id: true, code: true, name: true } },
      program: { select: { id: true, code: true, name: true } },
      level: { select: { id: true, levelNumber: true, name: true } },
    },
  },
  lecturerProfile: {
    select: {
      id: true,
      staffId: true,
      departmentId: true,
      title: true,
      specialization: true,
      department: { select: { id: true, code: true, name: true } },
    },
  },
  deptAdminProfile: {
    select: {
      id: true,
      staffId: true,
      departmentId: true,
      department: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

type RawSafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;

export function serializeUser(user: RawSafeUser) {
  const department =
    user.studentProfile?.department ??
    user.lecturerProfile?.department ??
    user.deptAdminProfile?.department ??
    null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: {
      department,
      departmentId: department?.id ?? null,
      matricNumber: user.studentProfile?.matricNumber ?? null,
      staffId:
        user.lecturerProfile?.staffId ??
        user.deptAdminProfile?.staffId ??
        null,
      program: user.studentProfile?.program ?? null,
      programId: user.studentProfile?.programId ?? null,
      level: user.studentProfile?.level ?? null,
      levelId: user.studentProfile?.levelId ?? null,
      title: user.lecturerProfile?.title ?? null,
      specialization: user.lecturerProfile?.specialization ?? null,
    },
  };
}

export async function listUsers(
  session: SessionContext,
  query: ListUsersQuery
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only Super Admin can list all users.");
  }

  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const andConditions: Prisma.UserWhereInput[] = [];

  if (query.role) {
    andConditions.push({ role: query.role });
  }
  if (query.status) {
    andConditions.push({ status: query.status });
  }
  if (query.departmentId) {
    andConditions.push({
      OR: [
        { studentProfile: { departmentId: query.departmentId } },
        { lecturerProfile: { departmentId: query.departmentId } },
        { deptAdminProfile: { departmentId: query.departmentId } },
      ],
    });
  }
  if (query.search) {
    const q = query.search.trim();
    if (q) {
      andConditions.push({
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          {
            studentProfile: {
              matricNumber: { contains: q, mode: "insensitive" },
            },
          },
          {
            lecturerProfile: {
              staffId: { contains: q, mode: "insensitive" },
            },
          },
          {
            deptAdminProfile: {
              staffId: { contains: q, mode: "insensitive" },
            },
          },
        ],
      });
    }
  }

  const where: Prisma.UserWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [total, rawItems] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: [{ createdAt: "desc" }, { email: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: rawItems.map(serializeUser),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createUser(
  session: SessionContext,
  input: CreateUserInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  if (session.role === "DEPARTMENT_ADMIN") {
    if (input.role !== "STUDENT" && input.role !== "LECTURER") {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Department Admin can only create students and lecturers."
      );
    }
    assertDepartmentScope(session, input.departmentId ?? "");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = input.phone ?? null;

  const created = await prisma.$transaction(async (tx) => {
    let auditDepartmentId: string | null = null;

    if (input.role === "STUDENT") {
      await validateStudentDepartmentProgramLevel(
        tx,
        input.departmentId!,
        input.programId!,
        input.levelId!
      );
      auditDepartmentId = input.departmentId!;
    } else if (
      input.role === "LECTURER" ||
      input.role === "DEPARTMENT_ADMIN"
    ) {
      const dept = await tx.department.findUnique({
        where: { id: input.departmentId! },
        select: { id: true },
      });
      if (!dept) {
        throw new AppError(404, "NOT_FOUND", "Department not found.");
      }
      auditDepartmentId = dept.id;
    }

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        role: input.role,
        status: "ACTIVE",
        ...(input.role === "STUDENT"
          ? {
              studentProfile: {
                create: {
                  matricNumber: input.matricNumber!.trim().toUpperCase(),
                  departmentId: input.departmentId!,
                  programId: input.programId!,
                  levelId: input.levelId!,
                },
              },
            }
          : {}),
        ...(input.role === "LECTURER"
          ? {
              lecturerProfile: {
                create: {
                  staffId: input.staffId!.trim().toUpperCase(),
                  departmentId: input.departmentId!,
                  title: input.title ?? null,
                  specialization: input.specialization ?? null,
                },
              },
            }
          : {}),
        ...(input.role === "DEPARTMENT_ADMIN"
          ? {
              deptAdminProfile: {
                create: {
                  staffId: input.staffId!.trim().toUpperCase(),
                  departmentId: input.departmentId!,
                },
              },
            }
          : {}),
      },
      select: SAFE_USER_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      departmentId: auditDepartmentId,
      afterSummary: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        departmentId: auditDepartmentId,
        matricNumber: user.studentProfile?.matricNumber ?? null,
        staffId:
          user.lecturerProfile?.staffId ??
          user.deptAdminProfile?.staffId ??
          null,
      },
    });

    return user;
  }, TX_OPTIONS);

  return serializeUser(created);
}

export async function updateUser(
  session: SessionContext,
  targetUserId: string,
  input: UpdateUserInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: targetUserId },
      select: SAFE_USER_SELECT,
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    const existingDeptId =
      existing.studentProfile?.departmentId ??
      existing.lecturerProfile?.departmentId ??
      existing.deptAdminProfile?.departmentId ??
      null;

    if (session.role === "DEPARTMENT_ADMIN") {
      if (existing.role !== "STUDENT" && existing.role !== "LECTURER") {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Department Admin can only update students and lecturers in their own department."
        );
      }
      assertDepartmentScope(session, existingDeptId ?? "");
      if (input.departmentId && input.departmentId !== existingDeptId) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Department Admin cannot move users to another department."
        );
      }
    }

    let nextDeptId = existingDeptId;

    if (existing.role === "STUDENT" && existing.studentProfile) {
      const targetDeptId =
        input.departmentId ?? existing.studentProfile.departmentId;
      const targetProgId = input.programId ?? existing.studentProfile.programId;
      const targetLevelId = input.levelId ?? existing.studentProfile.levelId;

      await validateStudentDepartmentProgramLevel(
        tx,
        targetDeptId,
        targetProgId,
        targetLevelId
      );

      if (
        targetDeptId !== existing.studentProfile.departmentId ||
        targetProgId !== existing.studentProfile.programId
      ) {
        await assertCanMoveStudentDepartmentOrProgram(
          tx,
          existing.studentProfile.id
        );
      }

      await tx.student.update({
        where: { id: existing.studentProfile.id },
        data: {
          departmentId: targetDeptId,
          programId: targetProgId,
          levelId: targetLevelId,
        },
      });
      nextDeptId = targetDeptId;
    } else if (existing.role === "LECTURER" && existing.lecturerProfile) {
      const targetDeptId =
        input.departmentId ?? existing.lecturerProfile.departmentId;

      if (targetDeptId !== existing.lecturerProfile.departmentId) {
        const dept = await tx.department.findUnique({
          where: { id: targetDeptId },
          select: { id: true },
        });
        if (!dept) {
          throw new AppError(404, "NOT_FOUND", "Department not found.");
        }
        await assertCanMoveLecturerDepartment(tx, existing.lecturerProfile.id);
      }

      await tx.lecturer.update({
        where: { id: existing.lecturerProfile.id },
        data: {
          departmentId: targetDeptId,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.specialization !== undefined
            ? { specialization: input.specialization }
            : {}),
        },
      });
      nextDeptId = targetDeptId;
    } else if (
      existing.role === "DEPARTMENT_ADMIN" &&
      existing.deptAdminProfile
    ) {
      const targetDeptId =
        input.departmentId ?? existing.deptAdminProfile.departmentId;

      if (targetDeptId !== existing.deptAdminProfile.departmentId) {
        const dept = await tx.department.findUnique({
          where: { id: targetDeptId },
          select: { id: true },
        });
        if (!dept) {
          throw new AppError(404, "NOT_FOUND", "Department not found.");
        }
      }

      await tx.departmentAdmin.update({
        where: { id: existing.deptAdminProfile.id },
        data: {
          departmentId: targetDeptId,
        },
      });
      nextDeptId = targetDeptId;
    }

    const after = await tx.user.update({
      where: { id: targetUserId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
      select: SAFE_USER_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: after.id,
      departmentId: nextDeptId,
      beforeSummary: {
        fullName: existing.fullName,
        phone: existing.phone,
        departmentId: existingDeptId,
        programId: existing.studentProfile?.programId ?? null,
        levelId: existing.studentProfile?.levelId ?? null,
        title: existing.lecturerProfile?.title ?? null,
        specialization: existing.lecturerProfile?.specialization ?? null,
      },
      afterSummary: {
        fullName: after.fullName,
        phone: after.phone,
        departmentId: nextDeptId,
        programId: after.studentProfile?.programId ?? null,
        levelId: after.studentProfile?.levelId ?? null,
        title: after.lecturerProfile?.title ?? null,
        specialization: after.lecturerProfile?.specialization ?? null,
      },
    });

    return after;
  }, TX_OPTIONS);

  return serializeUser(updated);
}

export async function updateUserStatus(
  session: SessionContext,
  targetUserId: string,
  input: UpdateUserStatusInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can change account status."
    );
  }

  if (session.userId === targetUserId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "You cannot change your own account status."
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: targetUserId },
      select: SAFE_USER_SELECT,
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    if (
      existing.role === "SUPER_ADMIN" &&
      existing.status === "ACTIVE" &&
      input.status !== "ACTIVE"
    ) {
      const activeSuperAdmins = await tx.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      if (activeSuperAdmins <= 1) {
        throw new AppError(
          409,
          "CONFLICT_LAST_SUPER_ADMIN",
          "Cannot suspend or deactivate the last active Super Admin."
        );
      }
    }

    const after = await tx.user.update({
      where: { id: targetUserId },
      data: {
        status: input.status,
        ...(input.status === "ACTIVE"
          ? { failedLoginCount: 0, lockedUntil: null }
          : {}),
      },
      select: SAFE_USER_SELECT,
    });

    const deptId =
      after.studentProfile?.departmentId ??
      after.lecturerProfile?.departmentId ??
      after.deptAdminProfile?.departmentId ??
      null;

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_STATUS_CHANGED",
      entityType: "User",
      entityId: after.id,
      departmentId: deptId,
      reason: input.reason ?? null,
      beforeSummary: { status: existing.status },
      afterSummary: { status: after.status },
    });

    return after;
  }, TX_OPTIONS);

  return serializeUser(updated);
}

export async function updateUserRole(
  session: SessionContext,
  targetUserId: string,
  input: UpdateUserRoleInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only Super Admin can change user roles.");
  }

  if (session.userId === targetUserId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "You cannot change your own role."
    );
  }

  if (input.role === "STUDENT") {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Role cannot be changed to or from STUDENT."
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: targetUserId },
      select: SAFE_USER_SELECT,
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    if (existing.role === "STUDENT") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Role cannot be changed to or from STUDENT."
      );
    }

    if (existing.role === input.role) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "User already has the selected role."
      );
    }

    if (existing.role === "SUPER_ADMIN" && existing.status === "ACTIVE") {
      const activeSuperAdmins = await tx.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      if (activeSuperAdmins <= 1) {
        throw new AppError(
          409,
          "CONFLICT_LAST_SUPER_ADMIN",
          "Cannot demote the last active Super Admin."
        );
      }
    }

    if (existing.role === "LECTURER" && existing.lecturerProfile) {
      await assertCanConvertFromLecturer(
        tx,
        existing.lecturerProfile.id,
        existing.id
      );
    }

    let nextDeptId: string | null = null;
    if (input.role === "LECTURER" || input.role === "DEPARTMENT_ADMIN") {
      if (!input.departmentId || !input.staffId) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "departmentId and staffId are required when converting to LECTURER or DEPARTMENT_ADMIN."
        );
      }
      const dept = await tx.department.findUnique({
        where: { id: input.departmentId },
        select: { id: true },
      });
      if (!dept) {
        throw new AppError(404, "NOT_FOUND", "Department not found.");
      }
      nextDeptId = dept.id;
    }

    // Remove previous role profile row if present
    if (existing.lecturerProfile) {
      await tx.lecturer.delete({
        where: { id: existing.lecturerProfile.id },
      });
    }
    if (existing.deptAdminProfile) {
      await tx.departmentAdmin.delete({
        where: { id: existing.deptAdminProfile.id },
      });
    }

    // Create new role profile row if needed
    if (input.role === "LECTURER") {
      await tx.lecturer.create({
        data: {
          userId: existing.id,
          departmentId: input.departmentId!,
          staffId: input.staffId!.trim().toUpperCase(),
          title: input.title ?? null,
          specialization: input.specialization ?? null,
        },
      });
    } else if (input.role === "DEPARTMENT_ADMIN") {
      await tx.departmentAdmin.create({
        data: {
          userId: existing.id,
          departmentId: input.departmentId!,
          staffId: input.staffId!.trim().toUpperCase(),
        },
      });
    }

    const after = await tx.user.update({
      where: { id: existing.id },
      data: { role: input.role },
      select: SAFE_USER_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: after.id,
      departmentId:
        nextDeptId ??
        existing.lecturerProfile?.departmentId ??
        existing.deptAdminProfile?.departmentId ??
        null,
      beforeSummary: {
        role: existing.role,
        departmentId:
          existing.lecturerProfile?.departmentId ??
          existing.deptAdminProfile?.departmentId ??
          null,
        staffId:
          existing.lecturerProfile?.staffId ??
          existing.deptAdminProfile?.staffId ??
          null,
      },
      afterSummary: {
        role: after.role,
        departmentId: nextDeptId,
        staffId:
          after.lecturerProfile?.staffId ??
          after.deptAdminProfile?.staffId ??
          null,
      },
    });

    return after;
  }, TX_OPTIONS);

  return serializeUser(updated);
}

export async function adminResetUserPassword(
  session: SessionContext,
  targetUserId: string,
  input: ResetUserPasswordInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can reset user passwords."
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: targetUserId },
      select: SAFE_USER_SELECT,
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    await tx.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    const deptId =
      existing.studentProfile?.departmentId ??
      existing.lecturerProfile?.departmentId ??
      existing.deptAdminProfile?.departmentId ??
      null;

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "USER_PASSWORD_CHANGED",
      entityType: "User",
      entityId: existing.id,
      departmentId: deptId,
      beforeSummary: { resetByAdmin: true },
      afterSummary: { resetByAdmin: true, lockoutCleared: true },
    });

    return {
      id: existing.id,
      email: existing.email,
      message: "Password has been reset.",
    };
  }, TX_OPTIONS);
}

