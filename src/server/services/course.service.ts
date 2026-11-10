import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import {
  normalizeCourseCode,
  type CreateCourseInput,
  type ListCoursesQuery,
  type UpdateCourseInput,
} from "@/lib/validators/course";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export async function listCourses(
  session: SessionContext,
  query: ListCoursesQuery
) {
  if (session.role === "STUDENT") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Students cannot list courses directly; use /api/v1/registrations/available."
    );
  }

  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const andConditions: Prisma.CourseWhereInput[] = [];

  if (session.role === "DEPARTMENT_ADMIN") {
    if (query.departmentId) {
      assertDepartmentScope(session, query.departmentId);
    }
    andConditions.push({ departmentId: session.departmentId ?? "__NO_DEPT__" });
  } else if (session.role === "LECTURER") {
    if (query.departmentId) {
      assertDepartmentScope(session, query.departmentId);
    }
    andConditions.push({
      assignments: {
        some: {
          lecturerId: session.lecturerId ?? "__NO_LECTURER__",
        },
      },
    });
  } else if (session.role === "SUPER_ADMIN") {
    if (query.departmentId) {
      andConditions.push({ departmentId: query.departmentId });
    }
  }

  if (query.programId) {
    andConditions.push({ programId: query.programId });
  }
  if (query.levelId) {
    andConditions.push({ levelId: query.levelId });
  }
  if (query.semesterName) {
    andConditions.push({ semesterName: query.semesterName });
  }
  if (query.isActive !== undefined) {
    andConditions.push({ isActive: query.isActive });
  }
  if (query.search) {
    const q = query.search.trim();
    if (q) {
      andConditions.push({
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      });
    }
  }

  const where: Prisma.CourseWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const currentSemester = await prisma.semester.findFirst({
    where: { isCurrent: true },
    include: {
      session: { select: { id: true, name: true, isCurrent: true } },
    },
  });

  const [total, rawCourses, availableLecturers] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: {
        department: { select: { id: true, code: true, name: true } },
        program: { select: { id: true, code: true, name: true } },
        level: { select: { id: true, levelNumber: true, name: true } },
        _count: {
          select: {
            registrations: true,
            results: true,
            assignments: true,
          },
        },
        assignments: {
          where: {
            semesterId: currentSemester?.id ?? "__NO_CURRENT_SEMESTER__",
          },
          include: {
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
          },
        },
      },
      orderBy: [{ code: "asc" }],
      skip,
      take: pageSize,
    }),
    session.role === "SUPER_ADMIN" || session.role === "DEPARTMENT_ADMIN"
      ? prisma.lecturer.findMany({
          where: {
            user: { status: "ACTIVE" },
            ...(session.role === "DEPARTMENT_ADMIN"
              ? { departmentId: session.departmentId ?? "__NO_DEPT__" }
              : {}),
          },
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
              },
            },
          },
          orderBy: { staffId: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const items = rawCourses.map((course) => {
    const currentAssignment =
      Array.isArray(course.assignments) && course.assignments.length > 0
        ? {
            id: course.assignments[0].id,
            semesterId: course.assignments[0].semesterId,
            lecturerId: course.assignments[0].lecturerId,
            lecturer: course.assignments[0].lecturer,
          }
        : null;

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      creditUnits: course.creditUnits,
      description: course.description,
      departmentId: course.departmentId,
      programId: course.programId,
      levelId: course.levelId,
      semesterName: course.semesterName,
      isActive: course.isActive,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      department: course.department,
      program: course.program,
      level: course.level,
      _count: course._count,
      currentAssignment,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    availableLecturers,
    currentSemester: currentSemester
      ? {
          id: currentSemester.id,
          name: currentSemester.name,
          registrationOpen: currentSemester.registrationOpen,
          sessionId: currentSemester.sessionId,
          sessionName: currentSemester.session.name,
        }
      : null,
  };
}

export async function createCourse(
  session: SessionContext,
  input: CreateCourseInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  let targetDepartmentId: string;
  if (session.role === "DEPARTMENT_ADMIN") {
    if (input.departmentId) {
      assertDepartmentScope(session, input.departmentId);
    }
    if (!session.departmentId) {
      throw new AppError(403, "FORBIDDEN", "No department scope assigned.");
    }
    targetDepartmentId = session.departmentId;
  } else {
    if (!input.departmentId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "departmentId is required when creating a course."
      );
    }
    targetDepartmentId = input.departmentId;
  }

  const normalizedCode = normalizeCourseCode(input.code);

  return prisma.$transaction(async (tx) => {
    const department = await tx.department.findUnique({
      where: { id: targetDepartmentId },
      select: { id: true, code: true, name: true },
    });
    if (!department) {
      throw new AppError(404, "NOT_FOUND", "Department not found.");
    }

    const program = await tx.program.findUnique({
      where: { id: input.programId },
      select: { id: true, code: true, name: true, departmentId: true },
    });
    if (!program) {
      throw new AppError(404, "NOT_FOUND", "Program not found.");
    }
    if (program.departmentId !== department.id) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Selected program does not belong to the course's department."
      );
    }

    const level = await tx.academicLevel.findUnique({
      where: { id: input.levelId },
      select: { id: true, levelNumber: true, name: true },
    });
    if (!level) {
      throw new AppError(404, "NOT_FOUND", "Academic level not found.");
    }

    const created = await tx.course.create({
      data: {
        code: normalizedCode,
        title: input.title.trim(),
        creditUnits: input.creditUnits,
        description: input.description ?? null,
        departmentId: department.id,
        programId: program.id,
        levelId: level.id,
        semesterName: input.semesterName,
        isActive: input.isActive ?? true,
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        program: { select: { id: true, code: true, name: true } },
        level: { select: { id: true, levelNumber: true, name: true } },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "ENTITY_CREATED",
      entityType: "Course",
      entityId: created.id,
      departmentId: created.departmentId,
      afterSummary: {
        code: created.code,
        title: created.title,
        creditUnits: created.creditUnits,
        departmentId: created.departmentId,
        programId: created.programId,
        levelId: created.levelId,
        semesterName: created.semesterName,
        isActive: created.isActive,
      },
    });

    return created;
  }, TX_OPTIONS);
}

export async function updateCourse(
  session: SessionContext,
  courseId: string,
  input: UpdateCourseInput
) {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "DEPARTMENT_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: {
            registrations: true,
            results: true,
            assignments: true,
          },
        },
      },
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Course not found.");
    }

    if (session.role === "DEPARTMENT_ADMIN") {
      assertDepartmentScope(session, existing.departmentId);
      if (
        input.departmentId !== undefined &&
        input.departmentId !== existing.departmentId
      ) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "Department Admin cannot move a course to another department."
        );
      }
    }

    const hasActivity =
      existing._count.registrations > 0 ||
      existing._count.results > 0 ||
      existing._count.assignments > 0;

    if (
      input.departmentId !== undefined &&
      input.departmentId !== existing.departmentId
    ) {
      if (hasActivity) {
        throw new AppError(
          409,
          "CONFLICT_IN_USE",
          "Cannot change department for a course that already has assignments, registrations, or results."
        );
      }
    }

    const structuralChange =
      (input.programId !== undefined &&
        input.programId !== existing.programId) ||
      (input.levelId !== undefined && input.levelId !== existing.levelId) ||
      (input.semesterName !== undefined &&
        input.semesterName !== existing.semesterName);

    if (structuralChange && hasActivity) {
      throw new AppError(
        409,
        "CONFLICT_IN_USE",
        "Cannot change program, academic level, or semester for a course that already has assignments, registrations, or results."
      );
    }

    if (
      input.creditUnits !== undefined &&
      input.creditUnits !== existing.creditUnits &&
      existing._count.results > 0
    ) {
      throw new AppError(
        409,
        "CONFLICT_IN_USE",
        "Cannot change credit units for a course that already has results."
      );
    }

    const targetDeptId = input.departmentId ?? existing.departmentId;
    const targetProgId = input.programId ?? existing.programId;
    const targetLevelId = input.levelId ?? existing.levelId;

    const department = await tx.department.findUnique({
      where: { id: targetDeptId },
      select: { id: true },
    });
    if (!department) {
      throw new AppError(404, "NOT_FOUND", "Department not found.");
    }

    const program = await tx.program.findUnique({
      where: { id: targetProgId },
      select: { id: true, departmentId: true },
    });
    if (!program) {
      throw new AppError(404, "NOT_FOUND", "Program not found.");
    }
    if (program.departmentId !== targetDeptId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Selected program does not belong to the course's department."
      );
    }

    const level = await tx.academicLevel.findUnique({
      where: { id: targetLevelId },
      select: { id: true },
    });
    if (!level) {
      throw new AppError(404, "NOT_FOUND", "Academic level not found.");
    }

    const updated = await tx.course.update({
      where: { id: courseId },
      data: {
        ...(input.code !== undefined
          ? { code: normalizeCourseCode(input.code) }
          : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.creditUnits !== undefined
          ? { creditUnits: input.creditUnits }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        departmentId: targetDeptId,
        programId: targetProgId,
        levelId: targetLevelId,
        ...(input.semesterName !== undefined
          ? { semesterName: input.semesterName }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        program: { select: { id: true, code: true, name: true } },
        level: { select: { id: true, levelNumber: true, name: true } },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "ENTITY_UPDATED",
      entityType: "Course",
      entityId: updated.id,
      departmentId: updated.departmentId,
      beforeSummary: {
        code: existing.code,
        title: existing.title,
        creditUnits: existing.creditUnits,
        departmentId: existing.departmentId,
        programId: existing.programId,
        levelId: existing.levelId,
        semesterName: existing.semesterName,
        isActive: existing.isActive,
      },
      afterSummary: {
        code: updated.code,
        title: updated.title,
        creditUnits: updated.creditUnits,
        departmentId: updated.departmentId,
        programId: updated.programId,
        levelId: updated.levelId,
        semesterName: updated.semesterName,
        isActive: updated.isActive,
      },
    });

    return updated;
  }, TX_OPTIONS);
}
