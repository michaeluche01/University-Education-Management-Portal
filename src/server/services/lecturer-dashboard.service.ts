import { AppError } from "@/lib/errors";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

export async function getLecturerDashboardData(session: SessionContext) {
  if (session.role !== "LECTURER" || !session.lecturerId) {
    throw new AppError(403, "FORBIDDEN", "Lecturer access required.");
  }

  const currentSemester = await prisma.semester.findFirst({
    where: { isCurrent: true },
    include: {
      session: { select: { id: true, name: true } },
    },
  });

  if (!currentSemester) {
    return {
      currentSemester: null,
      assignments: [],
      stats: {
        totalAssignedCourses: 0,
        totalRegisteredStudents: 0,
        returnedCoursesCount: 0,
        awaitingReviewCount: 0,
      },
    };
  }

  const assignments = await prisma.courseAssignment.findMany({
    where: {
      lecturerId: session.lecturerId,
      semesterId: currentSemester.id,
    },
    include: {
      course: {
        include: {
          department: { select: { id: true, code: true, name: true } },
          program: { select: { id: true, code: true, name: true } },
          level: { select: { id: true, levelNumber: true, name: true } },
        },
      },
      semester: {
        include: {
          session: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { course: { code: "asc" } },
  });

  const assignmentDetails = await Promise.all(
    assignments.map(async (asgn) => {
      const [registeredCount, results] = await Promise.all([
        prisma.courseRegistration.count({
          where: {
            courseId: asgn.courseId,
            semesterId: asgn.semesterId,
          },
        }),
        prisma.result.findMany({
          where: {
            courseId: asgn.courseId,
            semesterId: asgn.semesterId,
          },
          select: {
            id: true,
            status: true,
            feedback: true,
          },
        }),
      ]);

      const enteredCount = results.length;
      let status: "NOT_ENTERED" | "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED" =
        "NOT_ENTERED";
      let returnFeedback: string | null = null;

      const hasReturned = results.some((r) => r.status === "RETURNED");
      const hasSubmitted = results.some((r) => r.status === "SUBMITTED");
      const hasDraft = results.some((r) => r.status === "DRAFT");
      const allApproved =
        results.length > 0 &&
        results.length === registeredCount &&
        results.every((r) => r.status === "APPROVED");

      if (hasReturned) {
        status = "RETURNED";
        returnFeedback =
          results.find((r) => r.status === "RETURNED" && r.feedback)?.feedback ??
          "Results returned for correction";
      } else if (hasSubmitted) {
        status = "SUBMITTED";
      } else if (allApproved) {
        status = "APPROVED";
      } else if (hasDraft || enteredCount > 0) {
        status = "DRAFT";
      }

      return {
        id: asgn.id,
        courseId: asgn.courseId,
        semesterId: asgn.semesterId,
        course: {
          id: asgn.course.id,
          code: asgn.course.code,
          title: asgn.course.title,
          creditUnits: asgn.course.creditUnits,
          semesterName: asgn.course.semesterName,
          department: asgn.course.department,
          program: asgn.course.program,
          level: asgn.course.level,
        },
        semester: {
          id: asgn.semester.id,
          name: asgn.semester.name,
          sessionName: asgn.semester.session.name,
        },
        registeredCount,
        enteredCount,
        status,
        returnFeedback,
      };
    })
  );

  let totalRegisteredStudents = 0;
  let returnedCoursesCount = 0;
  let awaitingReviewCount = 0;

  for (const a of assignmentDetails) {
    totalRegisteredStudents += a.registeredCount;
    if (a.status === "RETURNED") returnedCoursesCount++;
    if (a.status === "SUBMITTED") awaitingReviewCount++;
  }

  return {
    currentSemester: {
      id: currentSemester.id,
      name: currentSemester.name,
      sessionName: currentSemester.session.name,
    },
    assignments: assignmentDetails,
    stats: {
      totalAssignedCourses: assignmentDetails.length,
      totalRegisteredStudents,
      returnedCoursesCount,
      awaitingReviewCount,
    },
  };
}
