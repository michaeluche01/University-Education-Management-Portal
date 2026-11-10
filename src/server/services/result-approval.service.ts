import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type {
  ApproveResultsInput,
  ReopenResultsInput,
  ReturnResultsInput,
  SubmissionsQuery,
} from "@/lib/validators/result";
import {
  assertDepartmentScope,
  assertLecturerCourseAssignment,
} from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";
import {
  computeResultFields,
  type GradeScaleBand,
} from "@/server/services/grading.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export async function listSubmissions(
  session: SessionContext,
  query: SubmissionsQuery
) {
  if (
    session.role !== "DEPARTMENT_ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  // 1. Resolve semester
  let semesterId = query.semesterId;
  if (!semesterId) {
    const currentSemester = await prisma.semester.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
    semesterId = currentSemester?.id;
  }

  if (!semesterId) {
    return {
      semester: null,
      submissions: [],
    };
  }

  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    include: {
      session: { select: { id: true, name: true } },
    },
  });

  const departmentIdScope =
    session.role === "DEPARTMENT_ADMIN" ? session.departmentId : undefined;

  // 2. Find all courses that have an assignment OR any non-draft result in this semester
  const coursesWhere: Prisma.CourseWhereInput = {
    ...(departmentIdScope ? { departmentId: departmentIdScope } : {}),
    OR: [
      { assignments: { some: { semesterId } } },
      { results: { some: { semesterId, status: { not: "DRAFT" } } } },
    ],
  };

  const courses = await prisma.course.findMany({
    where: coursesWhere,
    include: {
      department: { select: { id: true, code: true, name: true } },
      program: { select: { id: true, code: true, name: true } },
      level: { select: { id: true, levelNumber: true, name: true } },
      assignments: {
        where: { semesterId },
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
    orderBy: [{ department: { code: "asc" } }, { code: "asc" }],
  });

  const submissions = await Promise.all(
    courses.map(async (course) => {
      const [registeredCount, results] = await Promise.all([
        prisma.courseRegistration.count({
          where: { courseId: course.id, semesterId },
        }),
        prisma.result.findMany({
          where: {
            courseId: course.id,
            semesterId,
            status: { not: "DRAFT" }, // D3: Admins never see DRAFT results
          },
          select: {
            id: true,
            status: true,
            feedback: true,
          },
        }),
      ]);

      const submittedCount = results.filter((r) => r.status === "SUBMITTED").length;
      const approvedCount = results.filter((r) => r.status === "APPROVED").length;
      const returnedCount = results.filter((r) => r.status === "RETURNED").length;

      let overallStatus: "NO_RESULTS" | "SUBMITTED" | "APPROVED" | "RETURNED" =
        "NO_RESULTS";

      if (returnedCount > 0) {
        overallStatus = "RETURNED";
      } else if (submittedCount > 0) {
        overallStatus = "SUBMITTED";
      } else if (
        approvedCount > 0 &&
        approvedCount === registeredCount
      ) {
        overallStatus = "APPROVED";
      }

      const assignedLecturer = course.assignments[0]?.lecturer ?? null;
      const lecturerName = assignedLecturer
        ? `${assignedLecturer.title ? `${assignedLecturer.title} ` : ""}${assignedLecturer.user.fullName}`
        : null;

      return {
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        creditUnits: course.creditUnits,
        semesterName: course.semesterName,
        department: course.department,
        program: course.program,
        level: course.level,
        assignedLecturer: assignedLecturer
          ? {
              id: assignedLecturer.id,
              staffId: assignedLecturer.staffId,
              fullName: lecturerName,
            }
          : null,
        registeredCount,
        submittedCount,
        approvedCount,
        returnedCount,
        overallStatus,
      };
    })
  );

  return {
    semester: semester
      ? {
          id: semester.id,
          name: semester.name,
          sessionName: semester.session.name,
          isCurrent: semester.isCurrent,
        }
      : null,
    submissions,
  };
}

export async function approveResults(
  session: SessionContext,
  input: ApproveResultsInput
) {
  if (
    session.role !== "DEPARTMENT_ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Only administrators can approve results.");
  }

  const { courseId, semesterId, resultIds } = input;

  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true, departmentId: true, code: true },
    });
    if (!course) {
      throw new AppError(404, "NOT_FOUND", "Course not found.");
    }

    if (session.role === "DEPARTMENT_ADMIN") {
      assertDepartmentScope(session, course.departmentId);
    }

    // Find candidate results
    const where: Prisma.ResultWhereInput = {
      courseId,
      semesterId,
      ...(resultIds ? { id: { in: resultIds } } : {}),
    };

    const targetResults = await tx.result.findMany({ where });

    if (resultIds && targetResults.length !== resultIds.length) {
      throw new AppError(
        409,
        "CONFLICT",
        "One or more requested result IDs were not found for this course and semester."
      );
    }

    // Every row to approve MUST be currently SUBMITTED
    for (const res of targetResults) {
      if (res.status !== "SUBMITTED") {
        throw new AppError(
          409,
          "CONFLICT_STATUS",
          `Result ${res.id} is currently ${res.status}, not SUBMITTED. Cannot approve.`
        );
      }
      // Reviewer cannot approve results they entered themselves
      if (res.enteredById === session.userId) {
        throw new AppError(
          403,
          "FORBIDDEN_SELF_APPROVAL",
          "You cannot approve results that you entered yourself."
        );
      }
    }

    if (targetResults.length === 0) {
      throw new AppError(
        409,
        "CONFLICT_NOTHING_TO_APPROVE",
        "There are no submitted results awaiting approval for this course."
      );
    }

    // Recompute grade and gradePoint from the CURRENT grade scale
    const scaleRows = (await tx.gradeScale.findMany({
      orderBy: { minScore: "desc" },
    })) as GradeScaleBand[];

    const now = new Date();
    const targetIds = targetResults.map((r) => r.id);

    // Concurrency check: conditional updateMany
    const updateCount = await tx.result.updateMany({
      where: {
        id: { in: targetIds },
        status: "SUBMITTED",
      },
      data: {
        status: "APPROVED",
        reviewedById: session.userId,
        reviewedAt: now,
        feedback: null,
      },
    });

    if (updateCount.count !== targetIds.length) {
      throw new AppError(
        409,
        "CONFLICT_CONCURRENT_UPDATE",
        "One or more result rows changed status concurrently. Approval aborted."
      );
    }

    // Recompute grade and audit per row
    for (const res of targetResults) {
      const { totalScore, grade, gradePoint } = computeResultFields(
        res.caScore,
        res.examScore,
        scaleRows
      );

      await tx.result.update({
        where: { id: res.id },
        data: {
          totalScore,
          grade,
          gradePoint,
        },
      });

      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        departmentId: course.departmentId,
        action: "RESULT_APPROVED",
        entityType: "Result",
        entityId: res.id,
        beforeSummary: {
          status: res.status,
          caScore: res.caScore,
          examScore: res.examScore,
          totalScore: res.totalScore,
          grade: res.grade,
          gradePoint: res.gradePoint,
        },
        afterSummary: {
          status: "APPROVED",
          caScore: res.caScore,
          examScore: res.examScore,
          totalScore,
          grade,
          gradePoint,
        },
      });
    }

    return {
      approvedCount: targetIds.length,
      reviewedAt: now,
    };
  }, TX_OPTIONS);
}

export async function returnResults(
  session: SessionContext,
  input: ReturnResultsInput
) {
  if (
    session.role !== "DEPARTMENT_ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Only administrators can return results.");
  }

  const { courseId, semesterId, feedback, resultIds } = input;

  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true, departmentId: true, code: true },
    });
    if (!course) {
      throw new AppError(404, "NOT_FOUND", "Course not found.");
    }

    if (session.role === "DEPARTMENT_ADMIN") {
      assertDepartmentScope(session, course.departmentId);
    }

    const where: Prisma.ResultWhereInput = {
      courseId,
      semesterId,
      ...(resultIds ? { id: { in: resultIds } } : {}),
    };

    const targetResults = await tx.result.findMany({ where });

    if (resultIds && targetResults.length !== resultIds.length) {
      throw new AppError(
        409,
        "CONFLICT",
        "One or more requested result IDs were not found for this course and semester."
      );
    }

    for (const res of targetResults) {
      if (res.status !== "SUBMITTED") {
        throw new AppError(
          409,
          "CONFLICT_STATUS",
          `Result ${res.id} is currently ${res.status}, not SUBMITTED. Cannot return.`
        );
      }
    }

    if (targetResults.length === 0) {
      throw new AppError(
        409,
        "CONFLICT_NOTHING_TO_RETURN",
        "There are no submitted results to return for this course."
      );
    }

    const now = new Date();
    const targetIds = targetResults.map((r) => r.id);

    const updateCount = await tx.result.updateMany({
      where: {
        id: { in: targetIds },
        status: "SUBMITTED",
      },
      data: {
        status: "RETURNED",
        reviewedById: session.userId,
        reviewedAt: now,
        feedback,
      },
    });

    if (updateCount.count !== targetIds.length) {
      throw new AppError(
        409,
        "CONFLICT_CONCURRENT_UPDATE",
        "One or more result rows changed status concurrently. Return aborted."
      );
    }

    for (const res of targetResults) {
      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        departmentId: course.departmentId,
        action: "RESULT_RETURNED",
        entityType: "Result",
        entityId: res.id,
        reason: feedback,
        beforeSummary: {
          status: res.status,
          caScore: res.caScore,
          examScore: res.examScore,
          totalScore: res.totalScore,
          grade: res.grade,
          gradePoint: res.gradePoint,
        },
        afterSummary: {
          status: "RETURNED",
          feedback,
          caScore: res.caScore,
          examScore: res.examScore,
          totalScore: res.totalScore,
          grade: res.grade,
          gradePoint: res.gradePoint,
        },
      });
    }

    return {
      returnedCount: targetIds.length,
      reviewedAt: now,
    };
  }, TX_OPTIONS);
}

export async function reopenResults(
  session: SessionContext,
  input: ReopenResultsInput
) {
  if (
    session.role !== "DEPARTMENT_ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(403, "FORBIDDEN", "Only administrators can reopen results.");
  }

  const { courseId, semesterId, reason, resultIds } = input;

  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true, departmentId: true, code: true },
    });
    if (!course) {
      throw new AppError(404, "NOT_FOUND", "Course not found.");
    }

    if (session.role === "DEPARTMENT_ADMIN") {
      assertDepartmentScope(session, course.departmentId);
    }

    const where: Prisma.ResultWhereInput = {
      courseId,
      semesterId,
      ...(resultIds ? { id: { in: resultIds } } : {}),
    };

    const targetResults = await tx.result.findMany({ where });

    if (resultIds && targetResults.length !== resultIds.length) {
      throw new AppError(
        409,
        "CONFLICT",
        "One or more requested result IDs were not found for this course and semester."
      );
    }

    for (const res of targetResults) {
      if (res.status !== "APPROVED") {
        throw new AppError(
          409,
          "CONFLICT_STATUS",
          `Result ${res.id} is currently ${res.status}, not APPROVED. Cannot reopen.`
        );
      }
    }

    if (targetResults.length === 0) {
      throw new AppError(
        409,
        "CONFLICT_NOTHING_TO_REOPEN",
        "There are no approved results to reopen for this course."
      );
    }

    const now = new Date();
    const targetIds = targetResults.map((r) => r.id);
    const feedback = `[Reopened] ${reason}`;

    const updateCount = await tx.result.updateMany({
      where: {
        id: { in: targetIds },
        status: "APPROVED",
      },
      data: {
        status: "RETURNED",
        reopenedById: session.userId,
        reopenedAt: now,
        reopenReason: reason,
        feedback,
      },
    });

    if (updateCount.count !== targetIds.length) {
      throw new AppError(
        409,
        "CONFLICT_CONCURRENT_UPDATE",
        "One or more result rows changed status concurrently. Reopen aborted."
      );
    }

    for (const res of targetResults) {
      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        departmentId: course.departmentId,
        action: "RESULT_REOPENED",
        entityType: "Result",
        entityId: res.id,
        reason,
        beforeSummary: {
          status: res.status,
          caScore: res.caScore,
          examScore: res.examScore,
          totalScore: res.totalScore,
          grade: res.grade,
          gradePoint: res.gradePoint,
        },
        afterSummary: {
          status: "RETURNED",
          feedback,
          reopenReason: reason,
          caScore: res.caScore,
          examScore: res.examScore,
          totalScore: res.totalScore,
          grade: res.grade,
          gradePoint: res.gradePoint,
        },
      });
    }

    return {
      reopenedCount: targetIds.length,
      reopenedAt: now,
    };
  }, TX_OPTIONS);
}

export async function getResultHistory(
  session: SessionContext,
  resultId: string
) {
  const result = await prisma.result.findUnique({
    where: { id: resultId },
    include: {
      course: { select: { id: true, code: true, departmentId: true } },
    },
  });

  if (!result) {
    throw new AppError(404, "NOT_FOUND", "Result not found.");
  }

  // Authorization check
  if (session.role === "STUDENT") {
    throw new AppError(403, "FORBIDDEN", "Students cannot view audit history.");
  } else if (session.role === "LECTURER") {
    await assertLecturerCourseAssignment(
      session,
      result.courseId,
      result.semesterId
    );
  } else if (session.role === "DEPARTMENT_ADMIN") {
    assertDepartmentScope(session, result.course.departmentId);
  }

  // Query audit logs for this result
  // D3: Admins never see DRAFT results/actions
  const isAdmin =
    session.role === "DEPARTMENT_ADMIN" || session.role === "SUPER_ADMIN";

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "Result",
      entityId: resultId,
      ...(isAdmin ? { action: { not: "RESULT_DRAFT_SAVED" } } : {}),
    },
    include: {
      actor: {
        select: {
          id: true,
          fullName: true,
          role: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    resultId: result.id,
    courseCode: result.course.code,
    history: logs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: {
        id: log.actor.id,
        fullName: log.actor.fullName,
        role: log.actor.role,
      },
      reason: log.reason,
      beforeSummary: log.beforeSummary,
      afterSummary: log.afterSummary,
      createdAt: log.createdAt,
    })),
  };
}
