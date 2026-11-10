import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateFacultySchema } from "@/lib/validators/structure";
import { requireRole } from "@/server/auth/rbac";
import { updateFaculty } from "@/server/services/faculty.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateFacultySchema.parse(body);

    const updated = await updateFaculty(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

