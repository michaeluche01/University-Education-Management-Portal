import { connection, type NextRequest } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import {
  createCourseAssignmentSchema,
  listCourseAssignmentsQuerySchema,
} from "@/lib/validators/course";
import { requireRole } from "@/server/auth/rbac";
import {
  createCourseAssignment,
  listCourseAssignments,
} from "@/server/services/course-assignment.service";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "DEPARTMENT_ADMIN",
      "LECTURER",
    ]);
    const sp = request.nextUrl.searchParams;
    const parsedQuery = listCourseAssignmentsQuerySchema.parse({
      semesterId: sp.get("semesterId") || undefined,
      courseId: sp.get("courseId") || undefined,
      lecturerId: sp.get("lecturerId") || undefined,
    });

    const data = await listCourseAssignments(session, parsedQuery);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const body = await request.json();
    const parsed = createCourseAssignmentSchema.parse(body);
    const created = await createCourseAssignment(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

