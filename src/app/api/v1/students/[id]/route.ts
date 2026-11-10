import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateStudentSchema } from "@/lib/validators/member";
import { requireRole } from "@/server/auth/rbac";
import {
  getStudentById,
  updateStudentProfile,
} from "@/server/services/student.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await connection();
  try {
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { id } = await context.params;
    const data = await getStudentById(session, id);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateStudentSchema.parse(body);

    const updated = await updateStudentProfile(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

