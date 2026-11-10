import { AppError } from "@/lib/errors";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

export async function getSuperAdminDashboardStats(session: SessionContext) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Super Admin access required.");
  }

  const [
    facultiesCount,
    departmentsCount,
    programsCount,
    studentsCount,
    lecturersCount,
    currentSession,
    currentSemester,
    resultsAwaitingApproval,
  ] = await Promise.all([
    prisma.faculty.count(),
    prisma.department.count(),
    prisma.program.count(),
    prisma.student.count(),
    prisma.lecturer.count(),
    prisma.academicSession.findFirst({
      where: { isCurrent: true },
      select: { id: true, name: true },
    }),
    prisma.semester.findFirst({
      where: { isCurrent: true },
      select: {
        id: true,
        name: true,
        registrationOpen: true,
        session: { select: { id: true, name: true } },
      },
    }),
    prisma.result.count({
      where: { status: "SUBMITTED" },
    }),
  ]);

  const registrationsThisSemester = currentSemester
    ? await prisma.courseRegistration.count({
        where: { semesterId: currentSemester.id },
      })
    : 0;

  return {
    facultiesCount,
    departmentsCount,
    programsCount,
    studentsCount,
    lecturersCount,
    currentSessionName:
      currentSession?.name ?? currentSemester?.session.name ?? "None",
    currentSemesterName: currentSemester?.name ?? "None",
    registrationOpen: currentSemester?.registrationOpen ?? false,
    registrationsThisSemester,
    resultsAwaitingApproval,
  };
}

