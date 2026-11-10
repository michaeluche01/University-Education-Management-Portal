import { ApprovalsView } from "@/components/admin/ApprovalsView";
import { requireRole } from "@/server/auth/rbac";

export default async function DeptAdminApprovalsPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);
  return (
    <ApprovalsView
      role="DEPARTMENT_ADMIN"
      departmentName={session.departmentName ?? undefined}
    />
  );
}
