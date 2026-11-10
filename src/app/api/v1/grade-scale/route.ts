import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { putGradeScaleSchema } from "@/lib/validators/structure";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import {
  listGradeScale,
  replaceGradeScale,
} from "@/server/services/grade-scale.service";

export async function GET() {
  await connection();
  try {
    await requireAuth();
    const data = await listGradeScale();
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = putGradeScaleSchema.parse(body);

    const updated = await replaceGradeScale(session, parsed.rows);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

