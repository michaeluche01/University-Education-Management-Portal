import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type {
  PerformanceReportQuery,
  RegistrationReportQuery,
  StudentReportQuery,
} from "@/lib/validators/reports";
import { assertDepartmentScope } from "@/server/auth/policies";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { roundHalfUp2Decimals } from "./grading.service";

/**
 * Resolves the target semester for a report:
 * Returns the requested semester, or the current semester, or the latest semester.
 */
async function resolveSemester(semesterId?: string) {
  if (semesterId) {
    const sem = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: { session: true },
    });
    if (!sem) {
      throw new AppError(404, "NOT_FOUND", "Academic semester not found.");
    }
    return sem;
  }

  const current = await prisma.semester.findFirst({
    where: { isCurrent: true },
    include: { session: true },
  });

  if (current) return current;

  const latest = await prisma.semester.findFirst({
    orderBy: { createdAt: "desc" },
    include: { session: true },
  });

  if (!latest) {
    throw new AppError(404, "NOT_FOUND", "No academic semesters found.");
  }

  return latest;
}

/**
 * 1. Student List Report:
 * Scoped by department for DEPARTMENT_ADMIN, university-wide for SUPER_ADMIN.
 * LECTURER and STUDENT get 403.
 */
export async function getStudentReport(
  session: SessionContext,
  query: StudentReportQuery
) {
  if (session.role === "STUDENT" || session.role === "LECTURER") {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to view student reports.");
  }

  let targetDepartmentId: string | undefined;

  if (session.role === "DEPARTMENT_ADMIN") {
    if (query.departmentId && query.departmentId !== session.departmentId) {
      assertDepartmentScope(session, query.departmentId);
    }
    targetDepartmentId = session.departmentId ?? undefined;
  } else {
    // SUPER_ADMIN
    targetDepartmentId = query.departmentId || undefined;
  }

  const where: Prisma.StudentWhereInput = {};
  if (targetDepartmentId) where.departmentId = targetDepartmentId;
  if (query.programId) where.programId = query.programId;
  if (query.levelId) where.levelId = query.levelId;
  if (query.status) where.user = { status: query.status };

  if (query.search) {
    const s = query.search;
    where.OR = [
      { matricNumber: { contains: s, mode: "insensitive" } },
      { user: { fullName: { contains: s, mode: "insensitive" } } },
      { user: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      include: {
        user: { select: { fullName: true, email: true, phone: true, status: true } },
        department: { select: { id: true, name: true, code: true } },
        program: { select: { id: true, name: true, code: true } },
        level: { select: { id: true, name: true, levelNumber: true } },
      },
      orderBy: [{ level: { levelNumber: "asc" } }, { matricNumber: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const items = students.map((s) => ({
    id: s.id,
    matricNumber: s.matricNumber,
    fullName: s.user.fullName,
    email: s.user.email,
    phone: s.user.phone,
    status: s.user.status,
    departmentId: s.department.id,
    departmentName: s.department.name,
    departmentCode: s.department.code,
    programId: s.program.id,
    programName: s.program.name,
    programCode: s.program.code,
    levelId: s.level.id,
    levelName: s.level.name,
    levelNumber: s.level.levelNumber,
  }));

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

/**
 * 2. Course Registration Report:
 * Scoped by assignment for LECTURER, department for DEPARTMENT_ADMIN, university-wide for SUPER_ADMIN.
 * STUDENT gets 403.
 */
export async function getRegistrationReport(
  session: SessionContext,
  query: RegistrationReportQuery
) {
  if (session.role === "STUDENT") {
    throw new AppError(403, "FORBIDDEN", "Students cannot view registration reports.");
  }

  const targetSemester = await resolveSemester(query.semesterId);

  // Determine course filter based on role
  const courseWhere: Prisma.CourseWhereInput = {};

  if (session.role === "LECTURER") {
    if (!session.lecturerId) {
      throw new AppError(403, "FORBIDDEN", "Lecturer profile not found.");
    }
    // Lecturer only sees assigned courses for this semester
    const assignedCourses = await prisma.courseAssignment.findMany({
      where: { lecturerId: session.lecturerId, semesterId: targetSemester.id },
      select: { courseId: true },
    });
    const assignedCourseIds = assignedCourses.map((a) => a.courseId);

    if (query.courseId) {
      if (!assignedCourseIds.includes(query.courseId)) {
        throw new AppError(403, "FORBIDDEN", "You are not assigned to this course.");
      }
      courseWhere.id = query.courseId;
    } else {
      courseWhere.id = { in: assignedCourseIds };
    }
  } else if (session.role === "DEPARTMENT_ADMIN") {
    if (query.departmentId && query.departmentId !== session.departmentId) {
      assertDepartmentScope(session, query.departmentId);
    }
    courseWhere.departmentId = session.departmentId ?? undefined;
    if (query.courseId) courseWhere.id = query.courseId;
  } else {
    // SUPER_ADMIN
    if (query.departmentId) courseWhere.departmentId = query.departmentId;
    if (query.courseId) courseWhere.id = query.courseId;
  }

  if (query.programId) courseWhere.programId = query.programId;
  if (query.levelId) courseWhere.levelId = query.levelId;

  // 1. Fetch matching courses with department, level, program and lecturer assignments for this semester
  const courses = await prisma.course.findMany({
    where: courseWhere,
    include: {
      department: { select: { id: true, name: true, code: true } },
      level: { select: { id: true, name: true, levelNumber: true } },
      program: { select: { id: true, name: true, code: true } },
      assignments: {
        where: { semesterId: targetSemester.id },
        include: {
          lecturer: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
      },
    },
    orderBy: [{ level: { levelNumber: "asc" } }, { code: "asc" }],
  });

  const courseIds = courses.map((c) => c.id);

  // 2. Aggregate registration counts per course in this semester via DB groupBy
  const registrationCounts = await prisma.courseRegistration.groupBy({
    by: ["courseId"],
    where: {
      semesterId: targetSemester.id,
      courseId: { in: courseIds },
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  for (const rc of registrationCounts) {
    countMap.set(rc.courseId, rc._count.id);
  }

  // 3. Assemble course-level rows and calculate totals by level
  const levelTotalsMap = new Map<
    string,
    { levelId: string; levelName: string; levelNumber: number; count: number }
  >();

  let totalRegistrations = 0;

  const courseRows = courses.map((c) => {
    const regCount = countMap.get(c.id) ?? 0;
    totalRegistrations += regCount;

    // Accumulate level total
    const existingLevel = levelTotalsMap.get(c.levelId) ?? {
      levelId: c.level.id,
      levelName: c.level.name,
      levelNumber: c.level.levelNumber,
      count: 0,
    };
    existingLevel.count += regCount;
    levelTotalsMap.set(c.levelId, existingLevel);

    const lecturerNames = c.assignments
      .map((a) => a.lecturer.user.fullName)
      .filter(Boolean);

    return {
      courseId: c.id,
      courseCode: c.code,
      courseTitle: c.title,
      creditUnits: c.creditUnits,
      departmentId: c.department.id,
      departmentName: c.department.name,
      departmentCode: c.department.code,
      programName: c.program.name,
      levelId: c.level.id,
      levelName: c.level.name,
      levelNumber: c.level.levelNumber,
      lecturers: lecturerNames.length > 0 ? lecturerNames.join(", ") : "Unassigned",
      registeredCount: regCount,
    };
  });

  const totalsByLevel = Array.from(levelTotalsMap.values()).sort(
    (a, b) => a.levelNumber - b.levelNumber
  );

  return {
    semester: {
      id: targetSemester.id,
      name: targetSemester.name,
      sessionName: targetSemester.session.name,
      isCurrent: targetSemester.isCurrent,
    },
    courses: courseRows,
    totalsByLevel,
    totalRegistrations,
  };
}

/**
 * 3. Academic Performance Report:
 * APPROVED results ONLY for every role.
 * Scoped by assignment for LECTURER, department for DEPARTMENT_ADMIN, university-wide for SUPER_ADMIN.
 * STUDENT gets 403.
 */
export async function getPerformanceReport(
  session: SessionContext,
  query: PerformanceReportQuery
) {
  if (session.role === "STUDENT") {
    throw new AppError(403, "FORBIDDEN", "Students cannot view performance reports.");
  }

  const targetSemester = await resolveSemester(query.semesterId);

  // Determine course filter based on role
  const courseWhere: Prisma.CourseWhereInput = {};

  if (session.role === "LECTURER") {
    if (!session.lecturerId) {
      throw new AppError(403, "FORBIDDEN", "Lecturer profile not found.");
    }
    const assignedCourses = await prisma.courseAssignment.findMany({
      where: { lecturerId: session.lecturerId, semesterId: targetSemester.id },
      select: { courseId: true },
    });
    const assignedCourseIds = assignedCourses.map((a) => a.courseId);

    if (query.courseId) {
      if (!assignedCourseIds.includes(query.courseId)) {
        throw new AppError(403, "FORBIDDEN", "You are not assigned to this course.");
      }
      courseWhere.id = query.courseId;
    } else {
      courseWhere.id = { in: assignedCourseIds };
    }
  } else if (session.role === "DEPARTMENT_ADMIN") {
    if (query.departmentId && query.departmentId !== session.departmentId) {
      assertDepartmentScope(session, query.departmentId);
    }
    courseWhere.departmentId = session.departmentId ?? undefined;
    if (query.courseId) courseWhere.id = query.courseId;
  } else {
    // SUPER_ADMIN
    if (query.departmentId) courseWhere.departmentId = query.departmentId;
    if (query.courseId) courseWhere.id = query.courseId;
  }

  if (query.programId) courseWhere.programId = query.programId;
  if (query.levelId) courseWhere.levelId = query.levelId;

  // 1. Fetch scoped courses
  const courses = await prisma.course.findMany({
    where: courseWhere,
    include: {
      department: { select: { id: true, name: true, code: true } },
      level: { select: { id: true, name: true, levelNumber: true } },
      program: { select: { id: true, name: true, code: true } },
      assignments: {
        where: { semesterId: targetSemester.id },
        include: {
          lecturer: {
            include: { user: { select: { fullName: true } } },
          },
        },
      },
    },
    orderBy: [{ level: { levelNumber: "asc" } }, { code: "asc" }],
  });

  const courseIds = courses.map((c) => c.id);

  // 2. Aggregate APPROVED results per course via DB groupBy
  const [courseStats, gradeCounts, programResults] = await Promise.all([
    prisma.result.groupBy({
      by: ["courseId"],
      where: {
        semesterId: targetSemester.id,
        status: "APPROVED",
        courseId: { in: courseIds },
      },
      _count: { id: true },
      _avg: { totalScore: true },
      _max: { totalScore: true },
      _min: { totalScore: true },
    }),
    prisma.result.groupBy({
      by: ["courseId", "grade"],
      where: {
        semesterId: targetSemester.id,
        status: "APPROVED",
        courseId: { in: courseIds },
      },
      _count: { id: true },
    }),
    // 3. Program-level credit-weighted average GP across approved results
    prisma.result.findMany({
      where: {
        semesterId: targetSemester.id,
        status: "APPROVED",
        courseId: { in: courseIds },
      },
      select: {
        gradePoint: true,
        course: {
          select: {
            programId: true,
            creditUnits: true,
            program: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
  ]);

  // Index stats by courseId
  const statsMap = new Map<
    string,
    { count: number; avg: number; max: number; min: number }
  >();
  for (const s of courseStats) {
    statsMap.set(s.courseId, {
      count: s._count.id,
      avg: s._avg.totalScore ? roundHalfUp2Decimals(s._avg.totalScore) : 0,
      max: s._max.totalScore ?? 0,
      min: s._min.totalScore ?? 0,
    });
  }

  // Index grade counts by courseId -> grade
  const gradeMap = new Map<string, Record<string, number>>();
  for (const g of gradeCounts) {
    if (!gradeMap.has(g.courseId)) {
      gradeMap.set(g.courseId, { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
    }
    const dist = gradeMap.get(g.courseId)!;
    dist[g.grade] = (dist[g.grade] ?? 0) + g._count.id;
  }

  // Assemble course performance rows
  const coursePerformance = courses.map((c) => {
    const stat = statsMap.get(c.id) ?? { count: 0, avg: 0, max: 0, min: 0 };
    const dist = gradeMap.get(c.id) ?? { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    const passingCount =
      (dist.A ?? 0) +
      (dist.B ?? 0) +
      (dist.C ?? 0) +
      (dist.D ?? 0) +
      (dist.E ?? 0);

    const passRate =
      stat.count > 0
        ? roundHalfUp2Decimals((passingCount / stat.count) * 100)
        : 0;

    const lecturerNames = c.assignments
      .map((a) => a.lecturer.user.fullName)
      .filter(Boolean);

    return {
      courseId: c.id,
      courseCode: c.code,
      courseTitle: c.title,
      creditUnits: c.creditUnits,
      departmentId: c.department.id,
      departmentName: c.department.name,
      departmentCode: c.department.code,
      programName: c.program.name,
      levelName: c.level.name,
      levelNumber: c.level.levelNumber,
      lecturers: lecturerNames.length > 0 ? lecturerNames.join(", ") : "Unassigned",
      resultsCount: stat.count,
      averageScore: stat.avg,
      highestScore: stat.max,
      lowestScore: stat.min,
      passRate,
      gradeDistribution: dist,
    };
  });

  // Calculate program-level credit-weighted average GP
  const programMap = new Map<
    string,
    {
      programId: string;
      programName: string;
      programCode: string;
      totalQualityPoints: number;
      totalUnits: number;
      resultsCount: number;
    }
  >();

  for (const r of programResults) {
    const progId = r.course.programId;
    const existing = programMap.get(progId) ?? {
      programId: progId,
      programName: r.course.program.name,
      programCode: r.course.program.code,
      totalQualityPoints: 0,
      totalUnits: 0,
      resultsCount: 0,
    };

    existing.totalQualityPoints += r.gradePoint * r.course.creditUnits;
    existing.totalUnits += r.course.creditUnits;
    existing.resultsCount += 1;
    programMap.set(progId, existing);
  }

  const programPerformance = Array.from(programMap.values()).map((p) => {
    const weightedGpa =
      p.totalUnits > 0
        ? roundHalfUp2Decimals(p.totalQualityPoints / p.totalUnits)
        : 0;
    return {
      programId: p.programId,
      programName: p.programName,
      programCode: p.programCode,
      resultsCount: p.resultsCount,
      weightedGpa,
    };
  });

  return {
    semester: {
      id: targetSemester.id,
      name: targetSemester.name,
      sessionName: targetSemester.session.name,
      isCurrent: targetSemester.isCurrent,
    },
    note: "Only APPROVED results are included in academic performance summaries.",
    courses: coursePerformance,
    programs: programPerformance,
  };
}
