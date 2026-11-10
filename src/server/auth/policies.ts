import { AppError } from "@/lib/errors";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

/**
 * Enforces that a Department Admin can only access records in their own department.
 * Super Admin is allowed across all departments.
 * Always throws 403 (never 404) for out-of-scope access.
 */
export function assertDepartmentScope(
  session: SessionContext,
  targetDepartmentId: string
): void {
  if (session.role === "SUPER_ADMIN") {
    return;
  }

  if (
    session.role === "DEPARTMENT_ADMIN" &&
    session.departmentId &&
    session.departmentId === targetDepartmentId
  ) {
    return;
  }

  throw new AppError(
    403,
    "FORBIDDEN_DEPARTMENT_SCOPE",
    "You do not have permission to access resources in this department."
  );
}

/**
 * Enforces that a Lecturer is assigned to the given (courseId, semesterId).
 * Always throws 403 (never 404) for unassigned courses.
 */
export async function assertLecturerCourseAssignment(
  session: SessionContext,
  courseId: string,
  semesterId: string
): Promise<void> {
  if (session.role !== "LECTURER" || !session.lecturerId) {
    throw new AppError(
      403,
      "FORBIDDEN_COURSE_ASSIGNMENT",
      "You are not assigned to this course."
    );
  }

  const assignment = await prisma.courseAssignment.findUnique({
    where: {
      courseId_lecturerId_semesterId: {
        courseId,
        lecturerId: session.lecturerId,
        semesterId,
      },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new AppError(
      403,
      "FORBIDDEN_COURSE_ASSIGNMENT",
      "You are not assigned to this course for the specified semester."
    );
  }
}

