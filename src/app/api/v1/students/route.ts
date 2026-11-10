import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import {
  createStudentSchema,
  listStudentsQuerySchema,
} from "@/lib/validators/member";
import { requireRole } from "@/server/auth/rbac";
import {
  createStudentProfile,
  listStudents,
} from "@/server/services/student.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { searchParams } = new URL(request.url);
    const rawQuery: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) {
      if (v !== "") rawQuery[k] = v;
    }

    const query = listStudentsQuerySchema.parse(rawQuery);
    const data = await listStudents(session, query);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const body = await request.json();
    const parsed = createStudentSchema.parse(body);

    const created = await createStudentProfile(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

