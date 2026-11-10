import { cookies } from "next/headers";
import type { AccountStatus, Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/auth/jwt";
import { prisma } from "@/server/db/prisma";

export const ROLE_DASHBOARD_PATHS: Record<Role, string> = {
  STUDENT: "/student",
  LECTURER: "/lecturer",
  DEPARTMENT_ADMIN: "/dept-admin",
  SUPER_ADMIN: "/super-admin",
};

export interface SessionContext {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  studentId: string | null;
  lecturerId: string | null;
  departmentId: string | null;
  programId: string | null;
  levelId: string | null;
  matricNumber: string | null;
  staffId: string | null;
  departmentName: string | null;
  facultyName: string | null;
  programName: string | null;
  levelName: string | null;
}

export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token);
  if (!payload?.sub) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      studentProfile: {
        include: {
          department: { include: { faculty: true } },
          program: true,
          level: true,
        },
      },
      lecturerProfile: {
        include: {
          department: { include: { faculty: true } },
        },
      },
      deptAdminProfile: {
        include: {
          department: { include: { faculty: true } },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  const department =
    user.studentProfile?.department ??
    user.lecturerProfile?.department ??
    user.deptAdminProfile?.department ??
    null;

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    studentId: user.studentProfile?.id ?? null,
    lecturerId: user.lecturerProfile?.id ?? null,
    departmentId: department?.id ?? null,
    programId: user.studentProfile?.programId ?? null,
    levelId: user.studentProfile?.levelId ?? null,
    matricNumber: user.studentProfile?.matricNumber ?? null,
    staffId:
      user.lecturerProfile?.staffId ?? user.deptAdminProfile?.staffId ?? null,
    departmentName: department?.name ?? null,
    facultyName: department?.faculty?.name ?? null,
    programName: user.studentProfile?.program?.name ?? null,
    levelName: user.studentProfile?.level?.name ?? null,
  };
}

export async function requireAuth(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.", {
      clearCookie: true,
    });
  }
  return session;
}

export async function requireRole(
  allowedRoles: readonly Role[]
): Promise<SessionContext> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have permission to perform this action."
    );
  }
  return session;
}

