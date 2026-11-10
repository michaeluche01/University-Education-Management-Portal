import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { submitResultsSchema } from "@/lib/validators/result";
import { requireRole } from "@/server/auth/rbac";
import { submitResults } from "@/server/services/result.service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["LECTURER"]);
    const body = await request.json();
    const parsed = submitResultsSchema.parse(body);

    const result = await submitResults(session, parsed);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
