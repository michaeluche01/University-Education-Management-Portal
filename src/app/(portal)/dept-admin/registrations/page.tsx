import { RegistrationsView } from "@/components/admin/RegistrationsView";
import { requireRole } from "@/server/auth/rbac";

export default async function DeptAdminRegistrationsPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);
  return (
    <RegistrationsView
      role="DEPARTMENT_ADMIN"
      departmentName={session.departmentName}
    />
  );
}

