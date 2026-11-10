import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { requireRole } from "@/server/auth/rbac";
import { dropStudentRegistration } from "@/server/services/registration.service";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["STUDENT"]);
    const { id } = await context.params;

    const result = await dropStudentRegistration(session, id);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

