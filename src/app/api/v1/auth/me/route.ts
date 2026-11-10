import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { requireAuth } from "@/server/auth/rbac";

export async function GET() {
  await connection();
  try {
    const session = await requireAuth();
    return okResponse(session);
  } catch (error) {
    return handleApiError(error);
  }
}

