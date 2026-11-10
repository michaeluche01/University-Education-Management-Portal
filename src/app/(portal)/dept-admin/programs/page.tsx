import { ProgramsManager } from "@/components/admin/ProgramsManager";
import { requireRole } from "@/server/auth/rbac";

export default async function DeptAdminProgramsPage() {
  const session = await requireRole(["DEPARTMENT_ADMIN"]);
  return (
    <ProgramsManager
      role="DEPARTMENT_ADMIN"
      departmentName={session.departmentName}
    />
  );
}

