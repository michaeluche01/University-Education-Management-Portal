import { AuditLogsView } from "@/components/admin/AuditLogsView";
import { requireRole } from "@/server/auth/rbac";

export default async function DeptAdminAuditLogsPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);
  return (
    <AuditLogsView
      role="DEPARTMENT_ADMIN"
      departmentName={session.departmentName ?? undefined}
    />
  );
}
