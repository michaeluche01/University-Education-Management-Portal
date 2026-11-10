import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import {
  createRegistrationBatchSchema,
  listRegistrationsQuerySchema,
} from "@/lib/validators/registration";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import {
  listRegistrations,
  registerStudentCourses,
} from "@/server/services/registration.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const rawQuery: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) {
      if (v !== "") rawQuery[k] = v;
    }

    const query = listRegistrationsQuerySchema.parse(rawQuery);
    const data = await listRegistrations(session, query);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["STUDENT"]);
    const body = await request.json();
    const parsed = createRegistrationBatchSchema.parse(body);

    const created = await registerStudentCourses(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

