import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { createProgramSchema } from "@/lib/validators/structure";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { createProgram, listPrograms } from "@/server/services/program.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;

    const data = await listPrograms(session, { departmentId });
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
    const parsed = createProgramSchema.parse(body);

    const created = await createProgram(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

