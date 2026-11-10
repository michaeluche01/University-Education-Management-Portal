import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { changePasswordSchema } from "@/lib/validators/auth";
import { requireAuth } from "@/server/auth/rbac";
import { changeUserPassword } from "@/server/services/auth.service";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAuth();
    const body = await request.json();
    const parsed = changePasswordSchema.parse(body);

    await changeUserPassword(session, parsed);
    return okResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

