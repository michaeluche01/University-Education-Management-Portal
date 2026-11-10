import type { NextRequest } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { requireRole } from "@/server/auth/rbac";
import { deleteCourseAssignment } from "@/server/services/course-assignment.service";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { id } = await context.params;
    const result = await deleteCourseAssignment(session, id);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

