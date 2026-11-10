import { AppError } from "@/lib/errors";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { calculateWeightedGpa } from "@/server/services/grading.service";

export interface StudentResultItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  gradePoint: number;
  status: "APPROVED";
}

export interface StudentSemesterResults {
  semesterId: string;
  semesterName: string;
  sessionName: string;
  isCurrent: boolean;
  courses: StudentResultItem[];
  registeredUnits: number;
  earnedUnits: number;
  semesterGpa: number | null;
  cumulativeRegisteredUnits: number;
  cumulativeEarnedUnits: number;
  cumulativeGpa: number | null;
}

export interface StudentAcademicHistory {
  student: {
    id: string;
    fullName: string;
    email: string;
    matricNumber: string;
    department: string;
    departmentCode: string;
    faculty: string;
    facultyCode: string;
    program: string;
    level: string;
  };
  semesters: StudentSemesterResults[];
  careerSummary: {
    totalUnitsRegistered: number;
    totalUnitsEarned: number;
    cgpa: number | null;
    academicStanding: string;
  };
}

export async function getStudentAcademicHistory(
  session: SessionContext
): Promise<StudentAcademicHistory> {
  if (session.role !== "STUDENT") {
    throw new AppError(403, "FORBIDDEN", "Only students can view their academic results.");
  }

  if (!session.studentId) {
    throw new AppError(403, "FORBIDDEN", "Student record not found.");
  }

  const student = await prisma.student.findUnique({
    where: { id: session.studentId },
    include: {
      user: { select: { fullName: true, email: true } },
      department: {
        select: {
          name: true,
          code: true,
          faculty: { select: { name: true, code: true } },
        },
      },
      program: { select: { name: true, code: true } },
      level: { select: { name: true } },
    },
  });

  if (!student) {
    throw new AppError(404, "NOT_FOUND", "Student profile not found.");
  }

  // Decision D3: Only APPROVED results are visible to students
  const approvedResults = await prisma.result.findMany({
    where: {
      studentId: student.id,
      status: "APPROVED",
    },
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
          session: {
            select: {
              id: true,
              name: true,
              startDate: true,
            },
          },
        },
      },
    },
    orderBy: [
      { semester: { session: { startDate: "asc" } } },
      { semester: { name: "asc" } },
      { course: { code: "asc" } },
    ],
  });

  // Group by semester
  const semesterMap = new Map<
    string,
    {
      semesterId: string;
      semesterName: string;
      sessionName: string;
      isCurrent: boolean;
      sessionStartDate: Date;
      courses: StudentResultItem[];
    }
  >();

  for (const res of approvedResults) {
    const semId = res.semesterId;
    if (!semesterMap.has(semId)) {
      semesterMap.set(semId, {
        semesterId: semId,
        semesterName: res.semester.name,
        sessionName: res.semester.session.name,
        isCurrent: res.semester.isCurrent,
        sessionStartDate: res.semester.session.startDate,
        courses: [],
      });
    }

    semesterMap.get(semId)!.courses.push({
      id: res.id,
      courseId: res.course.id,
      courseCode: res.course.code,
      courseTitle: res.course.title,
      creditUnits: res.course.creditUnits,
      caScore: res.caScore,
      examScore: res.examScore,
      totalScore: res.totalScore,
      grade: res.grade,
      gradePoint: res.gradePoint,
      status: "APPROVED",
    });
  }

  // Sort semesters chronologically
  const sortedSemesters = Array.from(semesterMap.values()).sort((a, b) => {
    const diff = a.sessionStartDate.getTime() - b.sessionStartDate.getTime();
    if (diff !== 0) return diff;
    return a.semesterName.localeCompare(b.semesterName);
  });

  // Calculate semester and progressive cumulative metrics
  let runningTotalUnits = 0;
  let runningEarnedUnits = 0;
  const runningGpaRows: Array<{ gradePoint: number; creditUnits: number }> = [];

  const semesterResults: StudentSemesterResults[] = [];

  for (const sem of sortedSemesters) {
    let semRegUnits = 0;
    let semEarnedUnits = 0;
    const semGpaRows: Array<{ gradePoint: number; creditUnits: number }> = [];

    for (const c of sem.courses) {
      semRegUnits += c.creditUnits;
      if (c.gradePoint > 0) {
        semEarnedUnits += c.creditUnits;
      }
      semGpaRows.push({ gradePoint: c.gradePoint, creditUnits: c.creditUnits });

      runningTotalUnits += c.creditUnits;
      if (c.gradePoint > 0) {
        runningEarnedUnits += c.creditUnits;
      }
      runningGpaRows.push({
        gradePoint: c.gradePoint,
        creditUnits: c.creditUnits,
      });
    }

    const semGpa = calculateWeightedGpa(semGpaRows);
    const cumGpa = calculateWeightedGpa(runningGpaRows);

    semesterResults.push({
      semesterId: sem.semesterId,
      semesterName: sem.semesterName,
      sessionName: sem.sessionName,
      isCurrent: sem.isCurrent,
      courses: sem.courses,
      registeredUnits: semRegUnits,
      earnedUnits: semEarnedUnits,
      semesterGpa: semGpa,
      cumulativeRegisteredUnits: runningTotalUnits,
      cumulativeEarnedUnits: runningEarnedUnits,
      cumulativeGpa: cumGpa,
    });
  }

  const finalCgpa = calculateWeightedGpa(runningGpaRows);

  let standing = "Good Standing";
  if (finalCgpa !== null && finalCgpa < 1.5) {
    standing = "Academic Probation";
  } else if (finalCgpa === null) {
    standing = "No Graded Results";
  }

  return {
    student: {
      id: student.id,
      fullName: student.user.fullName,
      email: student.user.email,
      matricNumber: student.matricNumber,
      department: student.department.name,
      departmentCode: student.department.code,
      faculty: student.department.faculty.name,
      facultyCode: student.department.faculty.code,
      program: student.program.name,
      level: student.level.name,
    },
    semesters: semesterResults,
    careerSummary: {
      totalUnitsRegistered: runningTotalUnits,
      totalUnitsEarned: runningEarnedUnits,
      cgpa: finalCgpa,
      academicStanding: standing,
    },
  };
}
