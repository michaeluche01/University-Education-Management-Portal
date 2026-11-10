import { StudentsManager } from "@/components/admin/StudentsManager";
import { requireRole } from "@/server/auth/rbac";

export default async function DeptAdminStudentsPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);
  return (
    <StudentsManager
      role="DEPARTMENT_ADMIN"
      departmentName={session.departmentName}
    />
  );
}

