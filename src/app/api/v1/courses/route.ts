import { connection, type NextRequest } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import {
  createCourseSchema,
  listCoursesQuerySchema,
} from "@/lib/validators/course";
import { requireRole } from "@/server/auth/rbac";
import { createCourse, listCourses } from "@/server/services/course.service";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "DEPARTMENT_ADMIN",
      "LECTURER",
    ]);
    const sp = request.nextUrl.searchParams;
    const parsedQuery = listCoursesQuerySchema.parse({
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
      departmentId: sp.get("departmentId") || undefined,
      programId: sp.get("programId") || undefined,
      levelId: sp.get("levelId") || undefined,
      semesterName: sp.get("semesterName") || undefined,
      isActive: sp.get("isActive") || undefined,
      search: sp.get("search") || undefined,
    });

    const data = await listCourses(session, parsedQuery);
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
    const parsed = createCourseSchema.parse(body);
    const created = await createCourse(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

