import { requireRole } from "@/server/auth/rbac";
import { ReportsView } from "@/components/reports/ReportsView";

export default async function SuperAdminReportsPage() {
  const session = await requireRole(["SUPER_ADMIN"]);

  return (
    <ReportsView
      userRole={session.role}
      userDepartmentName="University-wide"
    />
  );
}

