import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { performanceReportQuerySchema } from "@/lib/validators/reports";
import { requireRole } from "@/server/auth/rbac";
import { getPerformanceReport } from "@/server/services/report.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "DEPARTMENT_ADMIN",
      "LECTURER",
    ]);
    const { searchParams } = new URL(request.url);

    const query = performanceReportQuerySchema.parse({
      semesterId: searchParams.get("semesterId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      courseId: searchParams.get("courseId") ?? undefined,
      programId: searchParams.get("programId") ?? undefined,
      levelId: searchParams.get("levelId") ?? undefined,
    });

    const result = await getPerformanceReport(session, query);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

