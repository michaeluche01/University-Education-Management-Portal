import type { NextRequest } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateUserRoleSchema } from "@/lib/validators/user";
import { requireRole } from "@/server/auth/rbac";
import { updateUserRole } from "@/server/services/user.service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateUserRoleSchema.parse(body);
    const updated = await updateUserRole(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
