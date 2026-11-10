import { connection, type NextRequest } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { createUserSchema, listUsersQuerySchema } from "@/lib/validators/user";
import { requireRole } from "@/server/auth/rbac";
import { createUser, listUsers } from "@/server/services/user.service";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const sp = request.nextUrl.searchParams;
    const parsedQuery = listUsersQuerySchema.parse({
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
      role: sp.get("role") || undefined,
      status: sp.get("status") || undefined,
      departmentId: sp.get("departmentId") || undefined,
      search: sp.get("search") || undefined,
    });

    const data = await listUsers(session, parsedQuery);
    return okResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = createUserSchema.parse(body);
    const created = await createUser(session, parsed);
    return okResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
