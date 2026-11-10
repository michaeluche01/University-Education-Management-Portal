import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { requireRole } from "@/server/auth/rbac";
import { getAvailableCoursesForStudent } from "@/server/services/registration.service";

export async function GET() {
  await connection();
  try {
    const session = await requireRole(["STUDENT"]);
    const data = await getAvailableCoursesForStudent(session);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

