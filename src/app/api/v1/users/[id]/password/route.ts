import type { NextRequest } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { resetUserPasswordSchema } from "@/lib/validators/user";
import { requireRole } from "@/server/auth/rbac";
import { adminResetUserPassword } from "@/server/services/user.service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = resetUserPasswordSchema.parse(body);
    const result = await adminResetUserPassword(session, id, parsed);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
