import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type {
  CreateCourseAssignmentInput,
  ListCourseAssignmentsQuery,
} from "@/lib/validators/course";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export async function listCourseAssignments(
  session: SessionContext,
  query: ListCourseAssignmentsQuery
) {
  if (session.role === "STUDENT") {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const andConditions: Prisma.CourseAssignmentWhereInput[] = [];

  if (session.role === "LECTURER") {
    if (query.lecturerId && query.lecturerId !== session.lecturerId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Lecturers can only view their own course assignments."
      );
    }
    andConditions.push({
      lecturerId: session.lecturerId ?? "__NO_LECTURER__",
    });
  } else if (session.role === "DEPARTMENT_ADMIN") {
    andConditions.push({
      course: {
        departmentId: session.departmentId ?? "__NO_DEPT__",
      },
    });
    if (query.lecturerId) {
      andConditions.push({ lecturerId: query.lecturerId });
    }
  } else if (session.role === "SUPER_ADMIN") {
    if (query.lecturerId) {
      andConditions.push({ lecturerId: query.lecturerId });
    }
  }

  if (query.semesterId) {
    andConditions.push({ semesterId: query.semesterId });
  }
  if (query.courseId) {
    andConditions.push({ courseId: query.courseId });
  }

  const where: Prisma.CourseAssignmentWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  return prisma.courseAssignment.findMany({
    where,
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          creditUnits: true,
          semesterName: true,
          isActive: true,
          departmentId: true,
          department: { select: { id: true, code: true, name: true } },
          program: { select: { id: true, code: true, name: true } },
          level: { select: { id: true, levelNumber: true, name: true } },
        },
      },
      lecturer: {
        select: {
          id: true,
          staffId: true,
          title: true,
          departmentId: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              status: true,
            },
          },
        },
      },
      semester: {
        select: {
          id: true,
          name: true,
          isCurrent: true,
          session: {
            select: {
              id: true,
              name: true,
              isCurrent: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function createCourseAssignment(
  session: SessionContext,
  input: CreateCourseAssignmentInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        code: true,
        title: true,
        departmentId: true,
        semesterName: true,
        isActive: true,
      },
    });
    if (!course) {
      throw new AppError(404, "NOT_FOUND", "Course not found.");
    }

    const lecturer = await tx.lecturer.findUnique({
      where: { id: input.lecturerId },
      select: {
        id: true,
        staffId: true,
        title: true,
        departmentId: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
      },
    });
    if (!lecturer) {
      throw new AppError(404, "NOT_FOUND", "Lecturer not found.");
    }

    const semester = await tx.semester.findUnique({
      where: { id: input.semesterId },
      select: {
        id: true,
        name: true,
        isCurrent: true,
        session: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
      },
    });
    if (!semester) {
      throw new AppError(404, "NOT_FOUND", "Semester not found.");
    }

    if (session.role === "DEPARTMENT_ADMIN") {
      assertDepartmentScope(session, course.departmentId);
      assertDepartmentScope(session, lecturer.departmentId);
    }

    if (lecturer.departmentId !== course.departmentId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Lecturer department must match the course department."
      );
    }

    if (semester.name !== course.semesterName) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Semester (${semester.name}) must match course semester (${course.semesterName}).`
      );
    }

    if (!semester.session.isCurrent) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Course assignments can only be created for a semester in the current academic session."
      );
    }

    if (!course.isActive) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Cannot assign a lecturer to an inactive course."
      );
    }

    if (lecturer.user.status !== "ACTIVE") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Cannot assign a lecturer whose account is not active."
      );
    }

    // Decision D12: ONE lecturer per course per semester
    const existingAssignment = await tx.courseAssignment.findFirst({
      where: {
        courseId: course.id,
        semesterId: semester.id,
      },
      select: { id: true, lecturerId: true },
    });

    if (existingAssignment) {
      throw new AppError(
        409,
        "CONFLICT_DUPLICATE",
        "A lecturer is already assigned to this course for this semester. Unassign the current lecturer first."
      );
    }

    const created = await tx.courseAssignment.create({
      data: {
        courseId: course.id,
        lecturerId: lecturer.id,
        semesterId: semester.id,
      },
      include: {
        course: { select: { id: true, code: true, title: true } },
        lecturer: {
          select: {
            id: true,
            staffId: true,
            title: true,
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
            session: { select: { id: true, name: true } },
          },
        },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "COURSE_ASSIGNED",
      entityType: "CourseAssignment",
      entityId: created.id,
      departmentId: course.departmentId,
      afterSummary: {
        courseId: course.id,
        courseCode: course.code,
        lecturerId: lecturer.id,
        staffId: lecturer.staffId,
        lecturerName: lecturer.user.fullName,
        semesterId: semester.id,
        semesterName: semester.name,
        sessionName: semester.session.name,
      },
    });

    return created;
  }, TX_OPTIONS);
}

export async function deleteCourseAssignment(
  session: SessionContext,
  assignmentId: string
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.courseAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            departmentId: true,
          },
        },
        lecturer: {
          select: {
            id: true,
            staffId: true,
            user: { select: { id: true, fullName: true } },
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
            session: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Course assignment not found.");
    }

    if (session.role === "DEPARTMENT_ADMIN") {
      assertDepartmentScope(session, existing.course.departmentId);
    }

    const resultCount = await tx.result.count({
      where: {
        courseId: existing.courseId,
        semesterId: existing.semesterId,
      },
    });

    if (resultCount > 0) {
      throw new AppError(
        409,
        "CONFLICT_IN_USE",
        "Cannot unassign lecturer because results already exist for this course and semester."
      );
    }

    await tx.courseAssignment.delete({
      where: { id: existing.id },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "COURSE_UNASSIGNED",
      entityType: "CourseAssignment",
      entityId: existing.id,
      departmentId: existing.course.departmentId,
      beforeSummary: {
        courseId: existing.course.id,
        courseCode: existing.course.code,
        lecturerId: existing.lecturer.id,
        staffId: existing.lecturer.staffId,
        lecturerName: existing.lecturer.user.fullName,
        semesterId: existing.semester.id,
        semesterName: existing.semester.name,
        sessionName: existing.semester.session.name,
      },
    });

    return {
      id: existing.id,
      unassigned: true,
    };
  }, TX_OPTIONS);
}

