import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateSemesterSchema } from "@/lib/validators/structure";
import { requireRole } from "@/server/auth/rbac";
import { updateSemester } from "@/server/services/session.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSemesterSchema.parse(body);

    const updated = await updateSemester(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

