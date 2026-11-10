import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { saveDraftResultsSchema } from "@/lib/validators/result";
import { requireRole } from "@/server/auth/rbac";
import { saveDraftResults } from "@/server/services/result.service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["LECTURER"]);
    const body = await request.json();
    const parsed = saveDraftResultsSchema.parse(body);

    const result = await saveDraftResults(session, parsed);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
