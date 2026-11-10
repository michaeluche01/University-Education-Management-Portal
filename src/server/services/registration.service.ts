import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import {
  type CreateRegistrationBatchInput,
  evaluateCourseEligibility,
  type ListRegistrationsQuery,
} from "@/lib/validators/registration";
import {
  assertDepartmentScope,
  assertLecturerCourseAssignment,
} from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export async function getAvailableCoursesForStudent(session: SessionContext) {
  if (
    session.role !== "STUDENT" ||
    !session.studentId ||
    !session.departmentId ||
    !session.programId ||
    !session.levelId
  ) {
    throw new AppError(403, "FORBIDDEN", "Student access required.");
  }

  const currentSemester = await prisma.semester.findFirst({
    where: { isCurrent: true },
    include: {
      session: { select: { id: true, name: true, isCurrent: true } },
    },
  });

  if (!currentSemester) {
    return {
      state: "noCurrentSemester" as const,
      registrationOpen: false,
      currentSemester: null,
      courses: [],
    };
  }

  const [eligibleCourses, existingRegistrations] = await Promise.all([
    prisma.course.findMany({
      where: {
        isActive: true,
        departmentId: session.departmentId,
        programId: session.programId,
        levelId: session.levelId,
        semesterName: currentSemester.name,
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        program: { select: { id: true, code: true, name: true } },
        level: { select: { id: true, levelNumber: true, name: true } },
        assignments: {
          where: { semesterId: currentSemester.id },
          include: {
            lecturer: {
              select: {
                id: true,
                staffId: true,
                title: true,
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.courseRegistration.findMany({
      where: {
        studentId: session.studentId,
        semesterId: currentSemester.id,
      },
      select: {
        id: true,
        courseId: true,
        registeredAt: true,
        result: { select: { id: true } },
      },
    }),
  ]);

  const regByCourseId = new Map(
    existingRegistrations.map((r) => [r.courseId, r])
  );

  const courses = eligibleCourses.map((course) => {
    const reg = regByCourseId.get(course.id) ?? null;
    const assigned = course.assignments[0]?.lecturer ?? null;
    const assignedLecturerName = assigned
      ? `${assigned.title ? `${assigned.title} ` : ""}${assigned.user.fullName}`
      : null;

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      creditUnits: course.creditUnits,
      description: course.description,
      semesterName: course.semesterName,
      department: course.department,
      program: course.program,
      level: course.level,
      assignedLecturerName,
      alreadyRegistered: Boolean(reg),
      registrationId: reg?.id ?? null,
      hasResult: Boolean(reg?.result),
    };
  });

  return {
    state: currentSemester.registrationOpen
      ? ("open" as const)
      : ("registrationClosed" as const),
    registrationOpen: currentSemester.registrationOpen,
    currentSemester: {
      id: currentSemester.id,
      name: currentSemester.name,
      registrationOpen: currentSemester.registrationOpen,
      session: currentSemester.session,
    },
    courses,
  };
}

export async function registerStudentCourses(
  session: SessionContext,
  input: CreateRegistrationBatchInput
) {
  if (
    session.role !== "STUDENT" ||
    !session.studentId ||
    !session.departmentId ||
    !session.programId ||
    !session.levelId
  ) {
    throw new AppError(403, "FORBIDDEN", "Only students can register courses.");
  }

  const currentSemester = await prisma.semester.findFirst({
    where: { isCurrent: true },
    include: {
      session: { select: { id: true, name: true } },
    },
  });

  if (!currentSemester) {
    throw new AppError(
      409,
      "NO_CURRENT_SEMESTER",
      "There is no active semester open for course registration."
    );
  }

  if (!currentSemester.registrationOpen) {
    throw new AppError(
      409,
      "REGISTRATION_CLOSED",
      "Course registration is currently closed for this semester."
    );
  }

  return prisma.$transaction(async (tx) => {
    const courses = await tx.course.findMany({
      where: { id: { in: input.courseIds } },
    });
    const existingRegs = await tx.courseRegistration.findMany({
      where: {
        studentId: session.studentId!,
        semesterId: currentSemester.id,
        courseId: { in: input.courseIds },
      },
      select: { courseId: true },
    });

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const alreadyRegCourseIds = new Set(existingRegs.map((r) => r.courseId));

    const eligibilityErrors: Array<{
      courseId: string;
      code: string;
      reason: string;
    }> = [];
    const duplicateErrors: Array<{
      courseId: string;
      code: string;
      reason: string;
    }> = [];

    for (const courseId of input.courseIds) {
      const course = courseById.get(courseId);
      if (!course) {
        eligibilityErrors.push({
          courseId,
          code: "COURSE_NOT_FOUND",
          reason: `Course "${courseId}" was not found.`,
        });
        continue;
      }

      const check = evaluateCourseEligibility(
        {
          departmentId: session.departmentId!,
          programId: session.programId!,
          levelId: session.levelId!,
        },
        course,
        {
          id: currentSemester.id,
          name: currentSemester.name,
          registrationOpen: currentSemester.registrationOpen,
        },
        alreadyRegCourseIds.has(course.id)
      );

      if (!check.eligible) {
        const entry = {
          courseId: course.id,
          code: check.code ?? "INELIGIBLE",
          reason: check.reason ?? "Course is not eligible for registration.",
        };
        if (check.code === "ALREADY_REGISTERED") {
          duplicateErrors.push(entry);
        } else {
          eligibilityErrors.push(entry);
        }
      }
    }

    if (eligibilityErrors.length > 0) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        eligibilityErrors[0].reason,
        { details: { courseErrors: [...eligibilityErrors, ...duplicateErrors] } }
      );
    }

    if (duplicateErrors.length > 0) {
      throw new AppError(
        409,
        "CONFLICT_DUPLICATE",
        duplicateErrors[0].reason,
        { details: { courseErrors: duplicateErrors } }
      );
    }

    const createdRegistrations = [];
    for (const courseId of input.courseIds) {
      const course = courseById.get(courseId)!;
      const reg = await tx.courseRegistration.create({
        data: {
          studentId: session.studentId!,
          courseId: course.id,
          semesterId: currentSemester.id,
        },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              creditUnits: true,
              semesterName: true,
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
        departmentId: session.departmentId,
        action: "REGISTRATION_CREATED",
        entityType: "CourseRegistration",
        entityId: reg.id,
        afterSummary: {
          studentId: session.studentId,
          matricNumber: session.matricNumber,
          courseId: course.id,
          courseCode: course.code,
          creditUnits: course.creditUnits,
          semesterId: currentSemester.id,
          semesterName: currentSemester.name,
          sessionName: currentSemester.session.name,
        },
      });

      createdRegistrations.push(reg);
    }

    return createdRegistrations;
  }, TX_OPTIONS);
}

export async function dropStudentRegistration(
  session: SessionContext,
  registrationId: string
) {
  if (session.role !== "STUDENT" || !session.studentId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only students can drop course registrations."
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.courseRegistration.findUnique({
      where: { id: registrationId },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            creditUnits: true,
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
            registrationOpen: true,
            session: { select: { id: true, name: true } },
          },
        },
        result: { select: { id: true } },
      },
    });

    if (!existing || existing.studentId !== session.studentId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to drop this course registration."
      );
    }

    if (!existing.semester.isCurrent || !existing.semester.registrationOpen) {
      throw new AppError(
        409,
        "REGISTRATION_CLOSED",
        "Cannot drop a course when registration is closed or outside the current semester."
      );
    }

    if (existing.result !== null) {
      throw new AppError(
        409,
        "CONFLICT_IN_USE",
        "Cannot drop a course registration that already has a result record."
      );
    }

    await tx.courseRegistration.delete({
      where: { id: existing.id },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      departmentId: session.departmentId,
      action: "REGISTRATION_DELETED",
      entityType: "CourseRegistration",
      entityId: existing.id,
      beforeSummary: {
        studentId: existing.studentId,
        matricNumber: session.matricNumber,
        courseId: existing.courseId,
        courseCode: existing.course.code,
        creditUnits: existing.course.creditUnits,
        semesterId: existing.semesterId,
        semesterName: existing.semester.name,
        sessionName: existing.semester.session.name,
      },
    });

    return {
      id: existing.id,
      deleted: true,
    };
  }, TX_OPTIONS);
}

export async function listRegistrations(
  session: SessionContext,
  query: ListRegistrationsQuery
) {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 50));
  const skip = (page - 1) * pageSize;

  // 1. STUDENT: own registrations only
  if (session.role === "STUDENT") {
    if (!session.studentId) {
      throw new AppError(403, "FORBIDDEN", "Student profile not found.");
    }

    let targetSemesterId = query.semesterId;
    if (!targetSemesterId) {
      const currentSemester = await prisma.semester.findFirst({
        where: { isCurrent: true },
        select: { id: true },
      });
      targetSemesterId = currentSemester?.id;
    }

    const where: Prisma.CourseRegistrationWhereInput = {
      studentId: session.studentId,
      ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
    };

    const [total, rawItems] = await Promise.all([
      prisma.courseRegistration.count({ where }),
      prisma.courseRegistration.findMany({
        where,
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              creditUnits: true,
              semesterName: true,
              department: { select: { id: true, code: true, name: true } },
              program: { select: { id: true, code: true, name: true } },
              level: { select: { id: true, levelNumber: true, name: true } },
              assignments: {
                where: targetSemesterId
                  ? { semesterId: targetSemesterId }
                  : undefined,
                include: {
                  lecturer: {
                    select: {
                      id: true,
                      title: true,
                      user: { select: { fullName: true } },
                    },
                  },
                },
              },
            },
          },
          semester: {
            select: {
              id: true,
              name: true,
              isCurrent: true,
              registrationOpen: true,
              session: { select: { id: true, name: true, isCurrent: true } },
            },
          },
          result: { select: { id: true } },
        },
        orderBy: [{ course: { code: "asc" } }],
        skip,
        take: pageSize,
      }),
    ]);

    const items = rawItems.map((row) => {
      const assigned = row.course.assignments[0]?.lecturer ?? null;
      const assignedLecturerName = assigned
        ? `${assigned.title ? `${assigned.title} ` : ""}${assigned.user.fullName}`
        : null;

      return {
        id: row.id,
        studentId: row.studentId,
        courseId: row.courseId,
        semesterId: row.semesterId,
        registeredAt: row.registeredAt,
        hasResult: Boolean(row.result),
        canDrop:
          row.semester.isCurrent &&
          row.semester.registrationOpen &&
          !row.result,
        assignedLecturerName,
        course: {
          id: row.course.id,
          code: row.course.code,
          title: row.course.title,
          creditUnits: row.course.creditUnits,
          semesterName: row.course.semesterName,
          department: row.course.department,
          program: row.course.program,
          level: row.course.level,
        },
        semester: row.semester,
      };
    });

    const totalCreditUnits = items.reduce(
      (sum, item) => sum + item.course.creditUnits,
      0
    );

    return {
      items,
      total,
      totalCreditUnits,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // 2. LECTURER: class list for an assigned (courseId, semesterId), no scores
  if (session.role === "LECTURER") {
    if (!query.courseId || !query.semesterId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "courseId and semesterId are required for lecturer class lists."
      );
    }

    await assertLecturerCourseAssignment(
      session,
      query.courseId,
      query.semesterId
    );

    const where: Prisma.CourseRegistrationWhereInput = {
      courseId: query.courseId,
      semesterId: query.semesterId,
    };

    const [total, items] = await Promise.all([
      prisma.courseRegistration.count({ where }),
      prisma.courseRegistration.findMany({
        where,
        select: {
          id: true,
          studentId: true,
          courseId: true,
          semesterId: true,
          registeredAt: true,
          student: {
            select: {
              id: true,
              matricNumber: true,
              user: { select: { fullName: true, email: true } },
              program: { select: { id: true, code: true, name: true } },
              level: { select: { id: true, levelNumber: true, name: true } },
            },
          },
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              creditUnits: true,
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
        orderBy: [{ student: { matricNumber: "asc" } }],
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

  // 3. DEPARTMENT_ADMIN and SUPER_ADMIN
  if (
    session.role !== "DEPARTMENT_ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  if (session.role === "DEPARTMENT_ADMIN" && query.departmentId) {
    assertDepartmentScope(session, query.departmentId);
  }

  const effectiveDepartmentId =
    session.role === "SUPER_ADMIN"
      ? query.departmentId
      : (session.departmentId ?? "__NO_DEPT__");

  const andConditions: Prisma.CourseRegistrationWhereInput[] = [];
  if (effectiveDepartmentId) {
    andConditions.push({
      course: { departmentId: effectiveDepartmentId },
    });
  }
  if (query.semesterId) {
    andConditions.push({ semesterId: query.semesterId });
  }
  if (query.courseId) {
    andConditions.push({ courseId: query.courseId });
  }
  if (query.programId) {
    andConditions.push({
      OR: [
        { student: { programId: query.programId } },
        { course: { programId: query.programId } },
      ],
    });
  }
  if (query.levelId) {
    andConditions.push({
      OR: [
        { student: { levelId: query.levelId } },
        { course: { levelId: query.levelId } },
      ],
    });
  }
  if (query.search) {
    const q = query.search.trim();
    if (q) {
      andConditions.push({
        OR: [
          { student: { matricNumber: { contains: q, mode: "insensitive" } } },
          {
            student: {
              user: { fullName: { contains: q, mode: "insensitive" } },
            },
          },
          {
            student: {
              user: { email: { contains: q, mode: "insensitive" } },
            },
          },
          { course: { code: { contains: q, mode: "insensitive" } } },
          { course: { title: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
  }

  const where: Prisma.CourseRegistrationWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [total, items] = await Promise.all([
    prisma.courseRegistration.count({ where }),
    prisma.courseRegistration.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        courseId: true,
        semesterId: true,
        registeredAt: true,
        student: {
          select: {
            id: true,
            matricNumber: true,
            user: { select: { fullName: true, email: true } },
            department: { select: { id: true, code: true, name: true } },
            program: { select: { id: true, code: true, name: true } },
            level: { select: { id: true, levelNumber: true, name: true } },
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            creditUnits: true,
            semesterName: true,
            department: { select: { id: true, code: true, name: true } },
            program: { select: { id: true, code: true, name: true } },
            level: { select: { id: true, levelNumber: true, name: true } },
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
            registrationOpen: true,
            session: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { registeredAt: "desc" },
        { student: { matricNumber: "asc" } },
      ],
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

