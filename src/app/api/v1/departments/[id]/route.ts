import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateDepartmentSchema } from "@/lib/validators/structure";
import { requireRole } from "@/server/auth/rbac";
import { updateDepartment } from "@/server/services/department.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateDepartmentSchema.parse(body);

    const updated = await updateDepartment(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

