import type { NextRequest } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateCourseSchema } from "@/lib/validators/course";
import { requireRole } from "@/server/auth/rbac";
import { updateCourse } from "@/server/services/course.service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateCourseSchema.parse(body);
    const updated = await updateCourse(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
