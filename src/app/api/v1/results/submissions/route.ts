import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { submissionsQuerySchema } from "@/lib/validators/result";
import { requireRole } from "@/server/auth/rbac";
import { listSubmissions } from "@/server/services/result-approval.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireRole(["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      semesterId: searchParams.get("semesterId") || undefined,
    };

    const query = submissionsQuerySchema.parse(rawQuery);
    const data = await listSubmissions(session, query);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
