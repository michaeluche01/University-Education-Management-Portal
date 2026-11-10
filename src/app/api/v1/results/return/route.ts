import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { returnResultsSchema } from "@/lib/validators/result";
import { requireRole } from "@/server/auth/rbac";
import { returnResults } from "@/server/services/result-approval.service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = returnResultsSchema.parse(body);

    const result = await returnResults(session, parsed);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
