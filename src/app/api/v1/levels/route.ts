import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { createLevelSchema } from "@/lib/validators/structure";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { createLevel, listLevels } from "@/server/services/level.service";

export async function GET() {
  await connection();
  try {
    await requireAuth();
    const data = await listLevels();
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
    const parsed = createLevelSchema.parse(body);

    const created = await createLevel(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

