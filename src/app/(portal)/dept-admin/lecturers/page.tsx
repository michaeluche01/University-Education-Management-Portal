import { LecturersManager } from "@/components/admin/LecturersManager";
import { requireRole } from "@/server/auth/rbac";

export default async function DeptAdminLecturersPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);
  return (
    <LecturersManager
      role="DEPARTMENT_ADMIN"
      departmentName={session.departmentName}
    />
  );
}

