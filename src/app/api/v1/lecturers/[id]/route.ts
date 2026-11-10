import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { updateLecturerSchema } from "@/lib/validators/member";
import { requireRole } from "@/server/auth/rbac";
import {
  getLecturerById,
  updateLecturerProfile,
} from "@/server/services/lecturer.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await connection();
  try {
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { id } = await context.params;
    const data = await getLecturerById(session, id);
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
    const parsed = updateLecturerSchema.parse(body);

    const updated = await updateLecturerProfile(session, id, parsed);
    return okResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

