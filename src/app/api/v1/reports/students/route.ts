import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { studentReportQuerySchema } from "@/lib/validators/reports";
import { requireRole } from "@/server/auth/rbac";
import { getStudentReport } from "@/server/services/report.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { searchParams } = new URL(request.url);

    const query = studentReportQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      programId: searchParams.get("programId") ?? undefined,
      levelId: searchParams.get("levelId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    const result = await getStudentReport(session, query);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
