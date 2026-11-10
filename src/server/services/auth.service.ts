import bcrypt from "bcryptjs";
import { AppError } from "@/lib/errors";
import type { ChangePasswordInput, LoginInput } from "@/lib/validators/auth";
import { ROLE_DASHBOARD_PATHS, type SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

// Precomputed cost-10 bcrypt hash of a random string to prevent timing enumeration on unknown emails
const DUMMY_BCRYPT_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5G2N1y5Q8xK9vP3mZ7aL1eW2";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: SessionContext["role"];
  };
  role: SessionContext["role"];
  dashboardPath: string;
}

export async function authenticateUser(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      studentProfile: { select: { departmentId: true } },
      lecturerProfile: { select: { departmentId: true } },
      deptAdminProfile: { select: { departmentId: true } },
    },
  });

  if (!user) {
    await bcrypt.compare(input.password, DUMMY_BCRYPT_HASH);
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password"
    );
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    throw new AppError(
      423,
      "ACCOUNT_LOCKED",
      "Too many attempts, try again later"
    );
  }

  const departmentId =
    user.studentProfile?.departmentId ??
    user.lecturerProfile?.departmentId ??
    user.deptAdminProfile?.departmentId ??
    null;

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordValid) {
    const baseFailures =
      user.lockedUntil && user.lockedUntil <= now ? 0 : user.failedLoginCount;
    const nextFailedCount = baseFailures + 1;
    const nextLockedUntil =
      nextFailedCount >= MAX_FAILED_ATTEMPTS
        ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
        : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: nextFailedCount,
          lockedUntil: nextLockedUntil,
        },
      });

      await writeAudit(tx, {
        actorId: user.id,
        actorRole: user.role,
        departmentId,
        action: "USER_LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        afterSummary: {
          failedLoginCount: nextFailedCount,
          lockedUntil: nextLockedUntil ? nextLockedUntil.toISOString() : null,
        },
      });
    });

    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password"
    );
  }

  // Only after a correct password check the account status
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw new AppError(403, "ACCOUNT_INACTIVE", "Account is not active");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await writeAudit(tx, {
      actorId: user.id,
      actorRole: user.role,
      departmentId,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
    });
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    role: user.role,
    dashboardPath: ROLE_DASHBOARD_PATHS[user.role],
  };
}

export async function changeUserPassword(
  session: SessionContext,
  input: ChangePasswordInput
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true, role: true },
  });

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.", {
      clearCookie: true,
    });
  }

  const currentMatches = await bcrypt.compare(
    input.currentPassword,
    user.passwordHash
  );
  if (!currentMatches) {
    throw new AppError(
      400,
      "INVALID_CURRENT_PASSWORD",
      "Current password is incorrect."
    );
  }

  const sameAsStored = await bcrypt.compare(
    input.newPassword,
    user.passwordHash
  );
  if (sameAsStored) {
    throw new AppError(
      400,
      "PASSWORD_UNCHANGED",
      "New password must be different from your current password."
    );
  }

  const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      departmentId: session.departmentId,
      action: "USER_PASSWORD_CHANGED",
      entityType: "User",
      entityId: user.id,
    });
  });
}

