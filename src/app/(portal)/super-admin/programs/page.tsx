import { ProgramsManager } from "@/components/admin/ProgramsManager";
import { requireRole } from "@/server/auth/rbac";

export default async function SuperAdminProgramsPage() {
  await requireRole(["SUPER_ADMIN"]);
  return <ProgramsManager role="SUPER_ADMIN" />;
}
