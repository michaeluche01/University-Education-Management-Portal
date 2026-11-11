import { handleApiError, okResponse } from "@/lib/errors";
import { registrationReportQuerySchema } from "@/lib/validators/reports";
import { requireRole } from "@/server/auth/rbac";
import { getRegistrationReport } from "@/server/services/report.service";

export async function GET(request: Request) {
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "DEPARTMENT_ADMIN",
      "LECTURER",
    ]);
    const { searchParams } = new URL(request.url);

    const query = registrationReportQuerySchema.parse({
      semesterId: searchParams.get("semesterId") ?? undefined,
      courseId: searchParams.get("courseId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      programId: searchParams.get("programId") ?? undefined,
      levelId: searchParams.get("levelId") ?? undefined,
    });

    const result = await getRegistrationReport(session, query);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

