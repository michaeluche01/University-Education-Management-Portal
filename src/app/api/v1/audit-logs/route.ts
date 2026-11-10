import { connection } from "next/server";
import { handleApiError, okResponse } from "@/lib/errors";
import { listAuditLogsQuerySchema } from "@/lib/validators/audit";
import { requireRole } from "@/server/auth/rbac";
import { listAuditLogs } from "@/server/services/audit-view.service";

export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireRole(["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { searchParams } = new URL(request.url);

    const rawQuery = {
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
      action: searchParams.get("action") || undefined,
      entityType: searchParams.get("entityType") || undefined,
      actorId: searchParams.get("actorId") || undefined,
      entityId: searchParams.get("entityId") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      fromDate: searchParams.get("fromDate") || undefined,
      toDate: searchParams.get("toDate") || undefined,
    };

    const query = listAuditLogsQuerySchema.parse(rawQuery);
    const result = await listAuditLogs(session, query);
    return okResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
