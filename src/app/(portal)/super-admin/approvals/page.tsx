import { ApprovalsView } from "@/components/admin/ApprovalsView";
import { requireRole } from "@/server/auth/rbac";

export default async function SuperAdminApprovalsPage() {
  await requireRole(["SUPER_ADMIN"]);
  return <ApprovalsView role="SUPER_ADMIN" />;
}
