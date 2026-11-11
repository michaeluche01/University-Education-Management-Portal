import { requireRole } from "@/server/auth/rbac";
import { ReportsView } from "@/components/reports/ReportsView";

export default async function LecturerReportsPage() {
  const session = await requireRole(["LECTURER"]);

  return (
    <ReportsView
      userRole={session.role}
      userDepartmentName={session.departmentName}
    />
  );
}

