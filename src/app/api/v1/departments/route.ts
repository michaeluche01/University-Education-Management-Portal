import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { createDepartmentSchema } from "@/lib/validators/structure";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import {
  createDepartment,
  listDepartments,
} from "@/server/services/department.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;

    const data = await listDepartments(session, { facultyId });
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
    const parsed = createDepartmentSchema.parse(body);

    const created = await createDepartment(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

