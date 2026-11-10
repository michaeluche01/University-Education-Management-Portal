import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { resultSheetQuerySchema } from "@/lib/validators/result";
import { requireAuth } from "@/server/auth/rbac";
import { getResultSheet } from "@/server/services/result.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      courseId: searchParams.get("courseId") ?? "",
      semesterId: searchParams.get("semesterId") ?? "",
    };

    const query = resultSheetQuerySchema.parse(rawQuery);
    const sheet = await getResultSheet(session, query);
    return okResponse(sheet);
  } catch (error) {
    return handleApiError(error);
  }
}
