import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { requireAuth } from "@/server/auth/rbac";
import { getResultHistory } from "@/server/services/result-approval.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await connection();
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    const history = await getResultHistory(session, id);
    return okResponse(history);
  } catch (error) {
    return handleApiError(error);
  }
}
