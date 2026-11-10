import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { createSessionSchema } from "@/lib/validators/structure";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { createSession, listSessions } from "@/server/services/session.service";

export async function GET() {
  await connection();
  try {
    await requireAuth();
    const data = await listSessions();
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = createSessionSchema.parse(body);

    const created = await createSession(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

