import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import {
  adminProfilePatchSchema,
  lecturerProfilePatchSchema,
  studentProfilePatchSchema,
} from "@/lib/validators/profile";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

const PROFILE_USER_SELECT = {
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
      gender: true,
      dateOfBirth: true,
      address: true,
      departmentId: true,
      programId: true,
      levelId: true,
      department: {
        select: {
          id: true,
          code: true,
          name: true,
          faculty: { select: { id: true, code: true, name: true } },
        },
      },
      program: {
        select: { id: true, code: true, name: true, durationYears: true },
      },
      level: { select: { id: true, levelNumber: true, name: true } },
    },
  },
  lecturerProfile: {
    select: {
      id: true,
      staffId: true,
      title: true,
      specialization: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          code: true,
          name: true,
          faculty: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
  deptAdminProfile: {
    select: {
      id: true,
      staffId: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          code: true,
          name: true,
          faculty: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export async function getOwnProfile(session: SessionContext) {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: PROFILE_USER_SELECT,
  });

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User profile not found.");
  }

  return user;
}

export async function updateOwnProfile(
  session: SessionContext,
  rawBody: unknown
) {
  if (session.role === "STUDENT") {
    const parsed = studentProfilePatchSchema.parse(rawBody);

    return prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: session.userId },
        select: PROFILE_USER_SELECT,
      });
      if (!before || !before.studentProfile) {
        throw new AppError(404, "NOT_FOUND", "Student profile not found.");
      }

      if (parsed.phone !== undefined) {
        await tx.user.update({
          where: { id: session.userId },
          data: { phone: parsed.phone },
        });
      }

      await tx.student.update({
        where: { id: before.studentProfile.id },
        data: {
          ...(parsed.address !== undefined ? { address: parsed.address } : {}),
          ...(parsed.dateOfBirth !== undefined
            ? { dateOfBirth: parsed.dateOfBirth }
            : {}),
          ...(parsed.gender !== undefined ? { gender: parsed.gender } : {}),
        },
      });

      const after = await tx.user.findUniqueOrThrow({
        where: { id: session.userId },
        select: PROFILE_USER_SELECT,
      });

      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        departmentId: session.departmentId,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: session.userId,
        beforeSummary: {
          phone: before.phone,
          address: before.studentProfile.address,
          dateOfBirth: before.studentProfile.dateOfBirth,
          gender: before.studentProfile.gender,
        },
        afterSummary: {
          phone: after.phone,
          address: after.studentProfile?.address ?? null,
          dateOfBirth: after.studentProfile?.dateOfBirth ?? null,
          gender: after.studentProfile?.gender ?? null,
        },
      });

      return after;
    }, TX_OPTIONS);
  }

  if (session.role === "LECTURER") {
    const parsed = lecturerProfilePatchSchema.parse(rawBody);

    return prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: session.userId },
        select: PROFILE_USER_SELECT,
      });
      if (!before || !before.lecturerProfile) {
        throw new AppError(404, "NOT_FOUND", "Lecturer profile not found.");
      }

      if (parsed.phone !== undefined) {
        await tx.user.update({
          where: { id: session.userId },
          data: { phone: parsed.phone },
        });
      }

      if (parsed.specialization !== undefined) {
        await tx.lecturer.update({
          where: { id: before.lecturerProfile.id },
          data: { specialization: parsed.specialization },
        });
      }

      const after = await tx.user.findUniqueOrThrow({
        where: { id: session.userId },
        select: PROFILE_USER_SELECT,
      });

      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        departmentId: session.departmentId,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: session.userId,
        beforeSummary: {
          phone: before.phone,
          specialization: before.lecturerProfile.specialization,
        },
        afterSummary: {
          phone: after.phone,
          specialization: after.lecturerProfile?.specialization ?? null,
        },
      });

      return after;
    }, TX_OPTIONS);
  }

  // DEPARTMENT_ADMIN or SUPER_ADMIN
  const parsed = adminProfilePatchSchema.parse(rawBody);

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: session.userId },
      select: PROFILE_USER_SELECT,
    });
    if (!before) {
      throw new AppError(404, "NOT_FOUND", "User profile not found.");
    }

    const after = await tx.user.update({
      where: { id: session.userId },
      data: { phone: parsed.phone },
      select: PROFILE_USER_SELECT,
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      departmentId: session.departmentId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: session.userId,
      beforeSummary: { phone: before.phone },
      afterSummary: { phone: after.phone },
    });

    return after;
  }, TX_OPTIONS);
}

