import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { requireAuth } from "@/server/auth/rbac";
import { getOwnProfile, updateOwnProfile } from "@/server/services/profile.service";

export async function GET() {
  await connection();
  try {
    const session = await requireAuth();
    const data = await getOwnProfile(session);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAuth();
    const body = await request.json();

    const updated = await updateOwnProfile(session, body);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

