import { requireRole } from "@/server/auth/rbac";
import { ReportsView } from "@/components/reports/ReportsView";

export default async function DeptAdminReportsPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);

  return (
    <ReportsView
      userRole={session.role}
      userDepartmentName={session.departmentName}
    />
  );
}

