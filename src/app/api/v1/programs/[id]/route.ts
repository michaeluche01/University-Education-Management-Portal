import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateProgramSchema } from "@/lib/validators/structure";
import { requireRole } from "@/server/auth/rbac";
import { updateProgram } from "@/server/services/program.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateProgramSchema.parse(body);

    const updated = await updateProgram(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

