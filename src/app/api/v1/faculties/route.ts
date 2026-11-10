import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { createFacultySchema } from "@/lib/validators/structure";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { createFaculty, listFaculties } from "@/server/services/faculty.service";

export async function GET() {
  await connection();
  try {
    const session = await requireAuth();
    const data = await listFaculties(session);
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
    const parsed = createFacultySchema.parse(body);

    const created = await createFaculty(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

