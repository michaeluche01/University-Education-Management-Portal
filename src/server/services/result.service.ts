import { AppError } from "@/lib/errors";
import type {
  ResultSheetQuery,
  SaveDraftResultsInput,
  SubmitResultsInput,
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
  roundHalfUp2Decimals,
  type GradeScaleBand,
} from "@/server/services/grading.service";

const TX_OPTIONS = {
  timeout: 15000,
  maxWait: 10000,
} as const;

export async function getResultSheet(
  session: SessionContext,
  query: ResultSheetQuery
) {
  if (session.role === "STUDENT") {
    throw new AppError(403, "FORBIDDEN", "Students cannot view result sheets.");
  }

  const { courseId, semesterId } = query;

  // 1. Fetch course & semester
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      department: { select: { id: true, code: true, name: true } },
      program: { select: { id: true, code: true, name: true } },
      level: { select: { id: true, levelNumber: true, name: true } },
    },
  });
  if (!course) {
    throw new AppError(404, "NOT_FOUND", "Course not found.");
  }

  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    include: {
      session: { select: { id: true, name: true } },
    },
  });
  if (!semester) {
    throw new AppError(404, "NOT_FOUND", "Semester not found.");
  }

  // 2. Role authorization & scoping
  if (session.role === "LECTURER") {
    await assertLecturerCourseAssignment(session, courseId, semesterId);
  } else if (session.role === "DEPARTMENT_ADMIN") {
    assertDepartmentScope(session, course.departmentId);
  }

  // 3. Fetch all registrations for this course and semester
  const registrations = await prisma.courseRegistration.findMany({
    where: {
      courseId,
      semesterId,
    },
    include: {
      student: {
        select: {
          id: true,
          matricNumber: true,
          user: { select: { fullName: true, email: true } },
          level: { select: { id: true, levelNumber: true, name: true } },
          program: { select: { id: true, code: true, name: true } },
        },
      },
      result: true,
    },
    orderBy: [{ student: { matricNumber: "asc" } }],
  });

  // 4. Transform rows according to D3:
  // LECTURER sees all statuses (DRAFT, SUBMITTED, APPROVED, RETURNED).
  // DEPARTMENT_ADMIN & SUPER_ADMIN never see DRAFT results (they appear as null / not submitted).
  const isLecturer = session.role === "LECTURER";

  let totalScoreSum = 0;
  let enteredCount = 0;
  let highestScore: number | null = null;
  let lowestScore: number | null = null;
  let passCount = 0;
  let failCount = 0;
  const gradeDistribution: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
  };

  const rows = registrations.map((reg) => {
    const rawResult = reg.result;
    let visibleResult: typeof rawResult | null = null;

    if (rawResult) {
      if (isLecturer) {
        visibleResult = rawResult;
      } else {
        // Admins never see DRAFT results
        if (rawResult.status !== "DRAFT") {
          visibleResult = rawResult;
        }
      }
    }

    if (visibleResult) {
      enteredCount++;
      totalScoreSum += visibleResult.totalScore;
      if (highestScore === null || visibleResult.totalScore > highestScore) {
        highestScore = visibleResult.totalScore;
      }
      if (lowestScore === null || visibleResult.totalScore < lowestScore) {
        lowestScore = visibleResult.totalScore;
      }
      if (visibleResult.gradePoint > 0) {
        passCount++;
      } else {
        failCount++;
      }
      if (visibleResult.grade in gradeDistribution) {
        gradeDistribution[visibleResult.grade]++;
      } else {
        gradeDistribution[visibleResult.grade] = 1;
      }
    }

    return {
      registrationId: reg.id,
      studentId: reg.student.id,
      matricNumber: reg.student.matricNumber,
      fullName: reg.student.user.fullName,
      email: reg.student.user.email,
      level: reg.student.level.name,
      program: reg.student.program.code,
      registeredAt: reg.registeredAt,
      result: visibleResult
        ? {
            id: visibleResult.id,
            caScore: visibleResult.caScore,
            examScore: visibleResult.examScore,
            totalScore: visibleResult.totalScore,
            grade: visibleResult.grade,
            gradePoint: visibleResult.gradePoint,
            status: visibleResult.status,
            feedback: visibleResult.feedback,
            submittedAt: visibleResult.submittedAt,
            reviewedAt: visibleResult.reviewedAt,
            reopenedAt: visibleResult.reopenedAt,
            reopenReason: visibleResult.reopenReason,
          }
        : null,
    };
  });

  const averageTotalScore =
    enteredCount > 0
      ? roundHalfUp2Decimals(totalScoreSum / enteredCount)
      : null;

  const summary = {
    registeredCount: registrations.length,
    enteredCount,
    averageTotalScore,
    highestScore,
    lowestScore,
    passCount,
    failCount,
    gradeDistribution,
  };

  return {
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      creditUnits: course.creditUnits,
      semesterName: course.semesterName,
      department: course.department,
      program: course.program,
      level: course.level,
    },
    semester: {
      id: semester.id,
      name: semester.name,
      isCurrent: semester.isCurrent,
      sessionName: semester.session.name,
    },
    summary,
    rows,
  };
}

export async function saveDraftResults(
  session: SessionContext,
  input: SaveDraftResultsInput
) {
  if (session.role !== "LECTURER") {
    throw new AppError(403, "FORBIDDEN", "Only lecturers can save draft results.");
  }

  const { courseId, semesterId, entries } = input;
  await assertLecturerCourseAssignment(session, courseId, semesterId);

  return prisma.$transaction(async (tx) => {
    // 1. Fetch course for departmentId
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, departmentId: true },
    });
    if (!course) {
      throw new AppError(404, "NOT_FOUND", "Course not found.");
    }

    // 2. Fetch all targeted registrations
    const registrationIds = entries.map((e) => e.registrationId);
    const registrations = await tx.courseRegistration.findMany({
      where: { id: { in: registrationIds } },
      include: {
        result: true,
      },
    });

    const regMap = new Map(registrations.map((r) => [r.id, r]));

    // Check that EVERY registration belongs to this course and semester
    for (const entry of entries) {
      const reg = regMap.get(entry.registrationId);
      if (!reg || reg.courseId !== courseId || reg.semesterId !== semesterId) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Registration ${entry.registrationId} does not belong to course ${course.code} for this semester.`
        );
      }

      // Check existing result status: cannot edit SUBMITTED or APPROVED
      if (
        reg.result &&
        (reg.result.status === "SUBMITTED" || reg.result.status === "APPROVED")
      ) {
        throw new AppError(
          409,
          "CONFLICT_IN_USE",
          `Cannot edit results that are already ${reg.result.status}. Contact your Department Admin to reopen them.`
        );
      }
    }

    // 3. Fetch grade scale rows
    const scaleRows = (await tx.gradeScale.findMany({
      orderBy: { minScore: "desc" },
    })) as GradeScaleBand[];

    let savedCount = 0;

    for (const entry of entries) {
      const reg = regMap.get(entry.registrationId)!;
      const { totalScore, grade, gradePoint } = computeResultFields(
        entry.caScore,
        entry.examScore,
        scaleRows
      );

      if (!reg.result) {
        // Create new DRAFT
        const created = await tx.result.create({
          data: {
            registrationId: reg.id,
            studentId: reg.studentId,
            courseId,
            semesterId,
            caScore: entry.caScore,
            examScore: entry.examScore,
            totalScore,
            grade,
            gradePoint,
            status: "DRAFT",
            enteredById: session.userId,
          },
        });

        await writeAudit(tx, {
          actorId: session.userId,
          actorRole: session.role,
          departmentId: course.departmentId,
          action: "RESULT_DRAFT_SAVED",
          entityType: "Result",
          entityId: created.id,
          afterSummary: {
            status: "DRAFT",
            caScore: created.caScore,
            examScore: created.examScore,
            totalScore: created.totalScore,
            grade: created.grade,
            gradePoint: created.gradePoint,
          },
        });

        savedCount++;
      } else {
        const existing = reg.result;
        // If changed, update and audit
        const changed =
          existing.caScore !== entry.caScore ||
          existing.examScore !== entry.examScore;

        if (changed) {
          // If existing is RETURNED, keep RETURNED and keep feedback
          const nextStatus =
            existing.status === "RETURNED" ? "RETURNED" : "DRAFT";

          const updated = await tx.result.update({
            where: { id: existing.id },
            data: {
              caScore: entry.caScore,
              examScore: entry.examScore,
              totalScore,
              grade,
              gradePoint,
              status: nextStatus,
              enteredById: session.userId,
            },
          });

          await writeAudit(tx, {
            actorId: session.userId,
            actorRole: session.role,
            departmentId: course.departmentId,
            action: "RESULT_DRAFT_SAVED",
            entityType: "Result",
            entityId: updated.id,
            beforeSummary: {
              status: existing.status,
              caScore: existing.caScore,
              examScore: existing.examScore,
              totalScore: existing.totalScore,
              grade: existing.grade,
              gradePoint: existing.gradePoint,
            },
            afterSummary: {
              status: updated.status,
              caScore: updated.caScore,
              examScore: updated.examScore,
              totalScore: updated.totalScore,
              grade: updated.grade,
              gradePoint: updated.gradePoint,
            },
          });

          savedCount++;
        }
      }
    }

    return { savedCount };
  }, TX_OPTIONS);
}

export async function submitResults(
  session: SessionContext,
  input: SubmitResultsInput
) {
  if (session.role !== "LECTURER") {
    throw new AppError(403, "FORBIDDEN", "Only lecturers can submit results.");
  }

  const { courseId, semesterId } = input;
  await assertLecturerCourseAssignment(session, courseId, semesterId);

  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, departmentId: true },
    });
    if (!course) {
      throw new AppError(404, "NOT_FOUND", "Course not found.");
    }

    const registrations = await tx.courseRegistration.findMany({
      where: { courseId, semesterId },
      include: {
        student: {
          select: {
            matricNumber: true,
            user: { select: { fullName: true } },
          },
        },
        result: true,
      },
    });

    if (registrations.length === 0) {
      throw new AppError(
        409,
        "CONFLICT_NO_REGISTRATIONS",
        "There are no registered students to submit results for."
      );
    }

    // Check that EVERY registration has a result row
    const missingStudents: string[] = [];
    for (const reg of registrations) {
      if (!reg.result) {
        missingStudents.push(
          `${reg.student.matricNumber} (${reg.student.user.fullName})`
        );
      }
    }

    if (missingStudents.length > 0) {
      throw new AppError(
        409,
        "CONFLICT_MISSING_ENTRIES",
        `Cannot submit results: ${missingStudents.length} student(s) have no score entries yet: ${missingStudents.join(", ")}.`
      );
    }

    // Filter eligible rows: DRAFT or RETURNED
    const eligibleResults = registrations
      .map((r) => r.result!)
      .filter((res) => res.status === "DRAFT" || res.status === "RETURNED");

    if (eligibleResults.length === 0) {
      throw new AppError(
        409,
        "CONFLICT_NOTHING_TO_SUBMIT",
        "All result rows are already submitted or approved. Nothing to submit."
      );
    }

    // Recompute grade and gradePoint from current grade scale
    const scaleRows = (await tx.gradeScale.findMany({
      orderBy: { minScore: "desc" },
    })) as GradeScaleBand[];

    const now = new Date();
    const targetIds = eligibleResults.map((r) => r.id);

    // Conditional update check for concurrency safety
    for (const res of eligibleResults) {
      const { totalScore, grade, gradePoint } = computeResultFields(
        res.caScore,
        res.examScore,
        scaleRows
      );

      const updateResult = await tx.result.updateMany({
        where: {
          id: res.id,
          status: { in: ["DRAFT", "RETURNED"] },
        },
        data: {
          totalScore,
          grade,
          gradePoint,
          status: "SUBMITTED",
          submittedAt: now,
          enteredById: session.userId,
        },
      });

      if (updateResult.count !== 1) {
        throw new AppError(
          409,
          "CONFLICT_CONCURRENT_UPDATE",
          "Result status changed concurrently. Please refresh the sheet."
        );
      }

      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        departmentId: course.departmentId,
        action: "RESULT_SUBMITTED",
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
          status: "SUBMITTED",
          caScore: res.caScore,
          examScore: res.examScore,
          totalScore,
          grade,
          gradePoint,
        },
      });
    }

    return {
      submittedCount: targetIds.length,
      submittedAt: now,
    };
  }, TX_OPTIONS);
}
