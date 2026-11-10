import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { approveResultsSchema } from "@/lib/validators/result";
import { requireRole } from "@/server/auth/rbac";
import { approveResults } from "@/server/services/result-approval.service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = approveResultsSchema.parse(body);

    const result = await approveResults(session, parsed);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
