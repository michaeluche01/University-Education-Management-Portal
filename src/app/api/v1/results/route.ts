import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { getStudentAcademicHistory } from "@/server/services/student-results.service";

export async function GET() {
  await connection();
  try {
    const session = await requireRole(["STUDENT"]);
    const history = await getStudentAcademicHistory(session);
    return okResponse(history);
  } catch (error) {
    return handleApiError(error);
  }
}
